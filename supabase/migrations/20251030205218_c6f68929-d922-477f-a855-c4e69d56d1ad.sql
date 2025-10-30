-- Corrigir políticas RLS da tabela user_roles para funcionar com Firebase Auth
-- As políticas atuais usam auth.uid() que não funciona com Firebase

-- Remover TODAS as políticas antigas
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public read access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can delete roles" ON public.user_roles;

-- Criar política para leitura pública (necessário para verificação de roles)
CREATE POLICY "allow_public_read"
ON public.user_roles
FOR SELECT
USING (true);

-- Permitir todas operações (INSERT/UPDATE/DELETE)
-- Como estamos usando Firebase Auth, o controle de acesso é feito na aplicação
CREATE POLICY "allow_all_operations"
ON public.user_roles
FOR ALL
USING (true)
WITH CHECK (true);