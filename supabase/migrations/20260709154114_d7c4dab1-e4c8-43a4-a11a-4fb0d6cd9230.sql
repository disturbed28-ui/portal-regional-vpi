CREATE POLICY "Comando pode atualizar integrantes"
ON public.integrantes_portal
FOR UPDATE
TO authenticated
USING (has_role((auth.uid())::text, 'comando'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'comando'::app_role));