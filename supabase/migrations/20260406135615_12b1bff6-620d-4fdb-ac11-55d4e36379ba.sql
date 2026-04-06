-- Add diretor_divisao to UPDATE policy for integrantes_afastados
DROP POLICY IF EXISTS "Admins e diretores podem atualizar afastamentos" ON public.integrantes_afastados;

CREATE POLICY "Admins e diretores podem atualizar afastamentos"
ON public.integrantes_afastados
FOR UPDATE
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    has_role((auth.uid())::text, 'diretor_regional'::app_role)
    AND (
      divisao_id IN (
        SELECT d.id FROM profiles p JOIN divisoes d ON d.regional_id = p.regional_id WHERE p.id = (auth.uid())::text
      )
      OR (
        divisao_id IS NULL
        AND normalize_divisao_text(divisao_texto) IN (
          SELECT normalize_divisao_text(d.nome) FROM profiles p JOIN divisoes d ON d.regional_id = p.regional_id WHERE p.id = (auth.uid())::text
        )
      )
    )
  )
  OR (
    has_role((auth.uid())::text, 'diretor_divisao'::app_role)
    AND (
      divisao_id IN (SELECT p.divisao_id FROM profiles p WHERE p.id = (auth.uid())::text AND p.divisao_id IS NOT NULL)
      OR (
        divisao_id IS NULL
        AND normalize_divisao_text(divisao_texto) IN (
          SELECT normalize_divisao_text(d.nome) FROM profiles p JOIN divisoes d ON d.id = p.divisao_id WHERE p.id = (auth.uid())::text
        )
      )
    )
  )
);