-- Remover função Firebase legada
DROP FUNCTION IF EXISTS public.get_firebase_uid_from_supabase();

-- Remover tabela de mapeamento Firebase
DROP TABLE IF EXISTS public.firebase_auth_mapping;