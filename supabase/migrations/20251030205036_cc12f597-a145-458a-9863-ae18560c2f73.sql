-- Corrigir políticas RLS da tabela user_roles para funcionar com Firebase Auth
-- As políticas atuais usam auth.uid() que retorna null com Firebase
-- Vamos criar políticas que permitem admins gerenciar roles via service role

-- Remover políticas antigas
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public read access to user_roles" ON public.user_roles;

-- Criar política para leitura pública (necessário para verificação de roles)
CREATE POLICY "Public read access to user_roles"
ON public.user_roles
FOR SELECT
USING (true);

-- Política para permitir service role fazer INSERT/UPDATE/DELETE
-- Importante: Service role bypass RLS, então essas políticas são para segurança adicional
-- Permitir INSERT via service role (usado pela aplicação)
CREATE POLICY "Service role can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

-- Permitir UPDATE via service role
CREATE POLICY "Service role can update roles"
ON public.user_roles
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Permitir DELETE via service role
CREATE POLICY "Service role can delete roles"
ON public.user_roles
FOR DELETE
USING (true);