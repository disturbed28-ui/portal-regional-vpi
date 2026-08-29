CREATE TYPE public.insight_status AS ENUM ('RESPONDEU', 'NAO_RESPONDEU', 'NAO_APLICAVEL');

CREATE OR REPLACE FUNCTION public.insight_divisao_no_escopo(_divisao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role((auth.uid())::text, 'admin'::app_role)
    OR public.has_role((auth.uid())::text, 'comando'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.divisoes d
      JOIN public.profiles p ON p.id = (auth.uid())::text
      WHERE d.id = _divisao_id
        AND d.regional_id = p.regional_id
    )
$$;

CREATE TABLE public.insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_insight integer NOT NULL,
  data_insight date NOT NULL,
  divisao_id uuid NOT NULL REFERENCES public.divisoes(id),
  regional_id uuid REFERENCES public.regionais(id),
  responsavel_nome text,
  criado_por text,
  atualizado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insights_unico_lancamento UNIQUE (divisao_id, numero_insight, data_insight)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insights visiveis no escopo"
ON public.insights FOR SELECT TO authenticated
USING (public.insight_divisao_no_escopo(divisao_id));

CREATE POLICY "Insights criados no escopo"
ON public.insights FOR INSERT TO authenticated
WITH CHECK (public.insight_divisao_no_escopo(divisao_id));

CREATE POLICY "Insights editados no escopo"
ON public.insights FOR UPDATE TO authenticated
USING (public.insight_divisao_no_escopo(divisao_id))
WITH CHECK (public.insight_divisao_no_escopo(divisao_id));

CREATE POLICY "Insights removidos no escopo"
ON public.insights FOR DELETE TO authenticated
USING (public.insight_divisao_no_escopo(divisao_id));

CREATE TRIGGER update_insights_updated_at
BEFORE UPDATE ON public.insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.insight_participacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id uuid NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  integrante_id uuid NOT NULL REFERENCES public.integrantes_portal(id),
  nome_colete_snapshot text NOT NULL,
  grau_snapshot text,
  cargo_grau_texto_snapshot text,
  divisao_id_snapshot uuid,
  status public.insight_status NOT NULL DEFAULT 'NAO_APLICAVEL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insight_participacoes_unica UNIQUE (insight_id, integrante_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_participacoes TO authenticated;
GRANT ALL ON public.insight_participacoes TO service_role;

ALTER TABLE public.insight_participacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participacoes visiveis no escopo"
ON public.insight_participacoes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insights i
  WHERE i.id = insight_id AND public.insight_divisao_no_escopo(i.divisao_id)
));

CREATE POLICY "Participacoes criadas no escopo"
ON public.insight_participacoes FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.insights i
  WHERE i.id = insight_id AND public.insight_divisao_no_escopo(i.divisao_id)
));

CREATE POLICY "Participacoes editadas no escopo"
ON public.insight_participacoes FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insights i
  WHERE i.id = insight_id AND public.insight_divisao_no_escopo(i.divisao_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.insights i
  WHERE i.id = insight_id AND public.insight_divisao_no_escopo(i.divisao_id)
));

CREATE POLICY "Participacoes removidas no escopo"
ON public.insight_participacoes FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insights i
  WHERE i.id = insight_id AND public.insight_divisao_no_escopo(i.divisao_id)
));

CREATE TRIGGER update_insight_participacoes_updated_at
BEFORE UPDATE ON public.insight_participacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_insights_divisao_data ON public.insights (divisao_id, data_insight);
CREATE INDEX idx_insight_participacoes_insight ON public.insight_participacoes (insight_id);
CREATE INDEX idx_insight_participacoes_integrante ON public.insight_participacoes (integrante_id);
