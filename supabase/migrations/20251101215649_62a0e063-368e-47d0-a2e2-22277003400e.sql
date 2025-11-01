-- Criar trigger para novos usuários do Supabase Auth
-- Este trigger cria automaticamente um profile e atribui role 'user' quando alguém se cadastra

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar profile automaticamente
  INSERT INTO public.profiles (id, name, photo_url, profile_status, status, created_at, updated_at)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Visitante'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'Pendente',
    'Online',
    NOW(),
    NOW()
  );
  
  -- Atribuir role padrão 'user'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id::text, 'user');
  
  RETURN NEW;
END;
$$;

-- Criar trigger que executa após insert em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_supabase ON auth.users;
CREATE TRIGGER on_auth_user_created_supabase
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_supabase_user();