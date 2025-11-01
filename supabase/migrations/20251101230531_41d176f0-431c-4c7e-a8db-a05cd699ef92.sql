-- Passo 1: Remover triggers e functions conflitantes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_supabase ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_supabase_user();

-- Passo 2: Remover campo firebase_uid não utilizado
ALTER TABLE public.integrantes_portal DROP COLUMN IF EXISTS firebase_uid;