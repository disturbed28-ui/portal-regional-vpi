-- Políticas de acesso ao bucket privado de fichas da Expansão
CREATE POLICY "expansao_fichas_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expansao-fichas'
  AND (
    public.has_role((auth.uid())::text, 'admin'::app_role)
    OR public.has_role((auth.uid())::text, 'comando'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT (p.regional_id)::text FROM public.profiles p WHERE p.id = (auth.uid())::text
    )
  )
);

CREATE POLICY "expansao_fichas_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expansao-fichas'
  AND (
    public.has_role((auth.uid())::text, 'admin'::app_role)
    OR public.has_role((auth.uid())::text, 'comando'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT (p.regional_id)::text FROM public.profiles p WHERE p.id = (auth.uid())::text
    )
  )
);

CREATE POLICY "expansao_fichas_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expansao-fichas'
  AND (
    public.has_role((auth.uid())::text, 'admin'::app_role)
    OR public.has_role((auth.uid())::text, 'comando'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT (p.regional_id)::text FROM public.profiles p WHERE p.id = (auth.uid())::text
    )
  )
);