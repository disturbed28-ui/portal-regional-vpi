-- Criar tabela para rastrear deltas/anomalias detectadas entre cargas
CREATE TABLE IF NOT EXISTS public.deltas_pendentes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_id integer NOT NULL,
  nome_colete text NOT NULL,
  divisao_texto text NOT NULL,
  tipo_delta text NOT NULL, -- SUMIU_ATIVOS, NOVO_ATIVOS, SUMIU_AFASTADOS, NOVO_AFASTADOS, RELACAO_DETECTADA
  carga_id uuid REFERENCES public.cargas_historico(id),
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, RESOLVIDO, IGNORADO
  prioridade integer NOT NULL DEFAULT 0, -- 1 = alta (SUMIU_ATIVOS), 0 = normal
  observacao_admin text,
  resolvido_por text,
  resolvido_em timestamp with time zone,
  dados_adicionais jsonb, -- cargo, regional, etc
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_deltas_status ON public.deltas_pendentes(status);
CREATE INDEX IF NOT EXISTS idx_deltas_registro ON public.deltas_pendentes(registro_id);
CREATE INDEX IF NOT EXISTS idx_deltas_divisao ON public.deltas_pendentes(divisao_texto);
CREATE INDEX IF NOT EXISTS idx_deltas_prioridade ON public.deltas_pendentes(prioridade DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_deltas_carga ON public.deltas_pendentes(carga_id);

-- RLS Policies
ALTER TABLE public.deltas_pendentes ENABLE ROW LEVEL SECURITY;

-- Admins podem fazer tudo
CREATE POLICY "Admins podem gerenciar todos deltas"
  ON public.deltas_pendentes
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Moderadores podem ver todos
CREATE POLICY "Moderadores podem ver todos deltas"
  ON public.deltas_pendentes
  FOR SELECT
  USING (has_role((auth.uid())::text, 'moderator'::app_role));

-- Diretores regionais e divisão veem sua região
CREATE POLICY "Regionais veem deltas de sua regional"
  ON public.deltas_pendentes
  FOR SELECT
  USING (
    (has_role((auth.uid())::text, 'diretor_regional'::app_role) OR 
     has_role((auth.uid())::text, 'regional'::app_role) OR
     has_role((auth.uid())::text, 'diretor_divisao'::app_role))
    AND divisao_texto IN (
      SELECT d.nome
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = (auth.uid())::text
    )
  );

-- Usuários comuns veem apenas seus próprios deltas
CREATE POLICY "Usuarios veem seus proprios deltas"
  ON public.deltas_pendentes
  FOR SELECT
  USING (
    has_role((auth.uid())::text, 'user'::app_role)
    AND EXISTS (
      SELECT 1 FROM integrantes_portal ip
      WHERE ip.registro_id = deltas_pendentes.registro_id
      AND ip.profile_id = (auth.uid())::text
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_deltas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deltas_updated_at
  BEFORE UPDATE ON public.deltas_pendentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deltas_updated_at();

-- View para histórico de deltas resolvidos (auditoria)
CREATE OR REPLACE VIEW public.vw_deltas_resolvidos AS
SELECT 
  d.*,
  ch.data_carga,
  ch.realizado_por as carga_realizada_por
FROM public.deltas_pendentes d
LEFT JOIN public.cargas_historico ch ON ch.id = d.carga_id
WHERE d.status IN ('RESOLVIDO', 'IGNORADO')
ORDER BY d.resolvido_em DESC;