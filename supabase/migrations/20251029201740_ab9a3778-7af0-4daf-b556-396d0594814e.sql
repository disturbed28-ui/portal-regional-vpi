-- Remove existing SELECT policy that checks auth.uid()
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create public read access policy for user_roles
CREATE POLICY "Public read access to user_roles"
ON user_roles
FOR SELECT
TO public
USING (true);

-- INSERT, UPDATE, DELETE policies remain admin-only (already configured)