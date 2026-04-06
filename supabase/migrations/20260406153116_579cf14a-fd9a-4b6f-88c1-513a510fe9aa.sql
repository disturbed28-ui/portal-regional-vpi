
ALTER TABLE public.solicitacoes_estagio 
ADD COLUMN status_flyer text NOT NULL DEFAULT 'pendente';

-- Add RLS policy for adm_regional and diretor_regional to update status_flyer
CREATE POLICY "adm_regional_e_diretor_regional_podem_atualizar_flyer"
ON public.solicitacoes_estagio
FOR UPDATE
TO authenticated
USING (
  (has_role((auth.uid())::text, 'adm_regional'::app_role) OR has_role((auth.uid())::text, 'diretor_regional'::app_role))
  AND regional_id IN (
    SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
  )
)
WITH CHECK (
  (has_role((auth.uid())::text, 'adm_regional'::app_role) OR has_role((auth.uid())::text, 'diretor_regional'::app_role))
  AND regional_id IN (
    SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
  )
);
