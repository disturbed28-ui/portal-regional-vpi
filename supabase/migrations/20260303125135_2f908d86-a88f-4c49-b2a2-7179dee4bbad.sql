-- Add adm_regional to the mensalidades_atraso SELECT policy
DROP POLICY IF EXISTS "usuarios_regional_podem_ver" ON public.mensalidades_atraso;

CREATE POLICY "usuarios_regional_podem_ver" 
ON public.mensalidades_atraso 
FOR SELECT 
USING (
  (
    has_role((auth.uid())::text, 'regional'::app_role) 
    OR has_role((auth.uid())::text, 'diretor_regional'::app_role) 
    OR has_role((auth.uid())::text, 'diretor_divisao'::app_role)
    OR has_role((auth.uid())::text, 'adm_regional'::app_role)
  ) 
  AND (
    divisao_texto IN (
      SELECT d.nome
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = (auth.uid())::text
    )
  )
);