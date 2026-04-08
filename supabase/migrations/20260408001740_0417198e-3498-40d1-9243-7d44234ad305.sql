
-- Tabela para registrar dispensas manuais de alertas de dados desatualizados
CREATE TABLE public.dados_atualizacao_dispensa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_dado text NOT NULL,
  dispensado_por text NOT NULL,
  valido_ate timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida
CREATE INDEX idx_dispensa_tipo_validade ON public.dados_atualizacao_dispensa (tipo_dado, valido_ate);

-- RLS
ALTER TABLE public.dados_atualizacao_dispensa ENABLE ROW LEVEL SECURITY;

-- Admins e regionais podem ver
CREATE POLICY "Admins e regionais podem ver dispensas"
  ON public.dados_atualizacao_dispensa FOR SELECT
  TO authenticated
  USING (true);

-- Admins e regionais podem inserir
CREATE POLICY "Admins e regionais podem inserir dispensas"
  ON public.dados_atualizacao_dispensa FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role((auth.uid())::text, 'admin'::public.app_role)
    OR public.has_role((auth.uid())::text, 'regional'::public.app_role)
    OR public.has_role((auth.uid())::text, 'diretor_regional'::public.app_role)
    OR public.has_role((auth.uid())::text, 'adm_regional'::public.app_role)
  );
