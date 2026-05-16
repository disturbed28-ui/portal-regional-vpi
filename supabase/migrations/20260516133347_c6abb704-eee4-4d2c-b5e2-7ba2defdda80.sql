CREATE OR REPLACE FUNCTION public.existe_decisao_divisao(_periodo_id uuid, _integrante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.avaliacoes_decisao_final
    WHERE periodo_id = _periodo_id
      AND integrante_id = _integrante_id
      AND etapa = 'divisao'
  )
$$;

DROP POLICY IF EXISTS "Inserir decisao avaliacao" ON public.avaliacoes_decisao_final;

CREATE POLICY "Inserir decisao avaliacao"
ON public.avaliacoes_decisao_final
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.avaliacao_periodos ap
    WHERE ap.id = avaliacoes_decisao_final.periodo_id
      AND ap.status = 'aberto'
  )
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR user_grau_num((auth.uid())::text) <= 4
    OR (
      etapa = 'divisao'
      AND NOT is_integrante_avaliado_por_dr(integrante_id)
      AND is_diretor_divisao_do_integrante((auth.uid())::text, integrante_id)
    )
    OR (
      etapa = 'regional'
      AND is_diretor_regional_do_integrante((auth.uid())::text, integrante_id)
      AND (
        is_integrante_avaliado_por_dr(integrante_id)
        OR existe_decisao_divisao(periodo_id, integrante_id)
      )
    )
  )
);