ALTER TABLE public.criterios_avaliacao
  ADD COLUMN IF NOT EXISTS peso numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_manual boolean NOT NULL DEFAULT false;

CREATE POLICY "Gestores podem deletar criterios"
ON public.criterios_avaliacao
FOR DELETE
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    user_has_screen_permission((auth.uid())::text, '/gestao-adm/criterios-avaliacao')
    AND (
      user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);