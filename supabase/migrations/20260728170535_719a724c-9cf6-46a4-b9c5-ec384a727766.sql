DROP POLICY IF EXISTS "Apenas admin pode deletar periodo" ON public.avaliacao_periodos;
CREATE POLICY "Gestores podem deletar periodos" ON public.avaliacao_periodos
FOR DELETE TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    user_has_screen_permission((auth.uid())::text, '/gestao-adm/periodos-avaliacao')
    AND (
      user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);