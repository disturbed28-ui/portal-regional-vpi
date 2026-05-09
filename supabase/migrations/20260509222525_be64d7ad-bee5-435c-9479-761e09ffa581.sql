CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (auth.uid())::text)
WITH CHECK (id = (auth.uid())::text);