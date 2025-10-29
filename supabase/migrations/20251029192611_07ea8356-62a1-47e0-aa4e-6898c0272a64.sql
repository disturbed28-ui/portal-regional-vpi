-- Remover políticas que dependem de Supabase Auth (incompatíveis com Firebase)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Criar política compatível com Firebase Auth
-- Permite que todos os usuários autenticados vejam todos os perfis
-- Necessário porque:
-- 1. Usamos Firebase Auth (não Supabase Auth), então auth.uid() retorna NULL
-- 2. Portal regional precisa que membros vejam outros membros (organograma)
-- 3. Dados de perfil são públicos entre membros (nome, foto, status)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Políticas de escrita permanecem inalteradas e seguras:
-- ✅ "Users can insert their own profile" - protege inserção
-- ✅ "Users can update their own non-admin fields" - protege edição própria
-- ✅ "Admins can update profile_status and observacao" - protege campos admin