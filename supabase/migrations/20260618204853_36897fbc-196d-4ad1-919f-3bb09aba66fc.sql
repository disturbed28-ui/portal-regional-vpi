DROP POLICY IF EXISTS "Apenas admin pode deletar decisao" ON public.avaliacoes_decisao_final;

CREATE POLICY "Reabrir decisao avaliacao"
ON public.avaliacoes_decisao_final
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM avaliacao_periodos ap
    WHERE ap.id = avaliacoes_decisao_final.periodo_id
      AND ap.status = 'aberto'
  )
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR user_grau_num((auth.uid())::text) <= 4
    OR is_diretor_regional_do_integrante((auth.uid())::text, integrante_id)
  )
);