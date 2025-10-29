-- Remove policies antigas que dependem de auth.uid()
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own non-admin fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profile_status and observacao" ON public.profiles;

-- Permite leitura pública (sem autenticação necessária)
CREATE POLICY "Public read access to profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Permite escrita apenas para service role (edge functions)
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update profiles"
ON public.profiles
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);