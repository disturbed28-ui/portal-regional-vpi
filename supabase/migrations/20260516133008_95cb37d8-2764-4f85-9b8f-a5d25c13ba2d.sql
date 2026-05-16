-- Helper: integrante é Diretor de Divisão (pelo cargo_grau_texto)
CREATE OR REPLACE FUNCTION public.is_integrante_diretor_divisao(_integrante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.integrantes_portal ip
    WHERE ip.id = _integrante_id
      AND lower(coalesce(ip.cargo_grau_texto, '')) LIKE '%diretor%divis%'
  )
$$;

-- Atualizar policy de INSERT em avaliacoes_decisao_final:
-- Quando o integrante é DD, a etapa 'regional' pode ser registrada pelo DR
-- diretamente, sem precisar de decisão prévia da etapa 'divisao'.
DROP POLICY IF EXISTS "DD pode inserir decisao divisao" ON public.avaliacoes_decisao_final;

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
      AND NOT is_integrante_diretor_divisao(integrante_id)
      AND is_diretor_divisao_do_integrante((auth.uid())::text, integrante_id)
    )
    OR (
      etapa = 'regional'
      AND is_diretor_regional_do_integrante((auth.uid())::text, integrante_id)
      AND (
        is_integrante_diretor_divisao(integrante_id)
        OR EXISTS (
          SELECT 1 FROM public.avaliacoes_decisao_final d2
          WHERE d2.periodo_id = avaliacoes_decisao_final.periodo_id
            AND d2.integrante_id = avaliacoes_decisao_final.integrante_id
            AND d2.etapa = 'divisao'
        )
      )
    )
  )
);