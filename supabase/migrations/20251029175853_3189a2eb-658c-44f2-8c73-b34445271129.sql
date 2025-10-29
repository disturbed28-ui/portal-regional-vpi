-- Passo 1: Remover todas as políticas RLS
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;

-- Passo 2: Remover TODAS as constraints e foreign keys
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- Passo 3: Alterar tipos de dados
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.user_roles ALTER COLUMN user_id TYPE text;

-- Passo 4: Recriar primary keys
ALTER TABLE public.profiles ADD PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD PRIMARY KEY (id);

-- Passo 5: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Passo 6: Recriar políticas RLS para profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid()::text = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid()::text = id);

-- Passo 7: Recriar políticas RLS para user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));