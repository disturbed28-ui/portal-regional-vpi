CREATE TABLE public.protocolos_viagem (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_profile_id text NOT NULL,
  integrante_id uuid REFERENCES public.integrantes_portal(id),
  nome_colete text NOT NULL,
  grau_texto text,
  divisao_id uuid REFERENCES public.divisoes(id),
  divisao_texto text,
  regional_id uuid REFERENCES public.regionais(id),
  regional_texto text,
  cidade_origem text NOT NULL,
  cidade_destino text NOT NULL,
  paradas text[] NOT NULL DEFAULT '{}',
  data_saida date NOT NULL,
  hora_saida text NOT NULL,
  data_retorno date NOT NULL,
  hora_retorno text NOT NULL,
  meio_transporte text NOT NULL,
  meio_transporte_outro text,
  acompanhado boolean NOT NULL DEFAULT false,
  com_cores boolean NOT NULL DEFAULT false,
  telefone text NOT NULL,
  destinatario_nome text,
  destinatario_cargo text,
  destinatario_telefone text,
  mensagem text,
  status text NOT NULL DEFAULT 'enviado',
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolos_viagem TO authenticated;
GRANT ALL ON public.protocolos_viagem TO service_role;

ALTER TABLE public.protocolos_viagem ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protocolo_viagem_no_escopo(_divisao_id uuid, _regional_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role((auth.uid())::text, 'admin'::app_role)
    OR public.has_role((auth.uid())::text, 'comando'::app_role)
    OR public.user_grau_num((auth.uid())::text) <= 4
    OR (public.user_grau_num((auth.uid())::text) = 5 AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = (auth.uid())::text AND p.regional_id = _regional_id))
    OR (public.user_grau_num((auth.uid())::text) = 6 AND _divisao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = (auth.uid())::text AND p.divisao_id = _divisao_id))
$$;

CREATE POLICY "Protocolos visiveis" ON public.protocolos_viagem FOR SELECT TO authenticated
USING (autor_profile_id = (auth.uid())::text OR public.protocolo_viagem_no_escopo(divisao_id, regional_id));

CREATE POLICY "Protocolos criados pelo autor" ON public.protocolos_viagem FOR INSERT TO authenticated
WITH CHECK (autor_profile_id = (auth.uid())::text);

CREATE POLICY "Protocolos editados pelo autor" ON public.protocolos_viagem FOR UPDATE TO authenticated
USING (autor_profile_id = (auth.uid())::text OR public.has_role((auth.uid())::text, 'admin'::app_role) OR public.has_role((auth.uid())::text, 'comando'::app_role))
WITH CHECK (autor_profile_id = (auth.uid())::text OR public.has_role((auth.uid())::text, 'admin'::app_role) OR public.has_role((auth.uid())::text, 'comando'::app_role));

CREATE POLICY "Protocolos removidos pelo autor" ON public.protocolos_viagem FOR DELETE TO authenticated
USING (autor_profile_id = (auth.uid())::text OR public.has_role((auth.uid())::text, 'admin'::app_role) OR public.has_role((auth.uid())::text, 'comando'::app_role));

CREATE TRIGGER trg_protocolos_viagem_updated BEFORE UPDATE ON public.protocolos_viagem
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_protocolos_viagem_divisao ON public.protocolos_viagem(divisao_id, data_saida DESC);
CREATE INDEX idx_protocolos_viagem_autor ON public.protocolos_viagem(autor_profile_id);