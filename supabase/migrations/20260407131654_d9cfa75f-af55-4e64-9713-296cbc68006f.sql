CREATE POLICY "Regional pode atualizar mensalidades da regional"
ON public.mensalidades_atraso
FOR UPDATE
TO authenticated
USING (
  has_role((auth.uid())::text, 'regional'::public.app_role)
  AND regional_id IN (
    SELECT p.regional_id
    FROM public.profiles p
    WHERE p.id = (auth.uid())::text
  )
)
WITH CHECK (
  has_role((auth.uid())::text, 'regional'::public.app_role)
  AND regional_id IN (
    SELECT p.regional_id
    FROM public.profiles p
    WHERE p.id = (auth.uid())::text
  )
);