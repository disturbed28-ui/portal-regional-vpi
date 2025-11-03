-- CORREÇÃO CRÍTICA 1: Proteger dados pessoais na tabela profiles
-- Remover política pública perigosa
DROP POLICY IF EXISTS "Public read access to profiles" ON public.profiles;

-- Criar política restrita apenas para usuários autenticados
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Usuários podem ver seus próprios perfis completos
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = (auth.uid())::text);

-- Admins e moderadores podem ver todos os perfis
CREATE POLICY "Admins and moderators can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR 
  has_role((auth.uid())::text, 'moderator'::app_role)
);

-- CORREÇÃO CRÍTICA 2: Proteger informações de roles administrativas
-- Remover políticas públicas perigosas
DROP POLICY IF EXISTS "allow_public_read" ON public.user_roles;
DROP POLICY IF EXISTS "allow_all_operations" ON public.user_roles;

-- Usuários podem ver apenas seus próprios roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = (auth.uid())::text);

-- Admins podem ver todos os roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Apenas admins podem gerenciar roles (INSERT, UPDATE, DELETE)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Service role (edge functions) pode gerenciar roles
CREATE POLICY "Service role can insert roles"
ON public.user_roles FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update roles"
ON public.user_roles FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can delete roles"
ON public.user_roles FOR DELETE
TO service_role
USING (true);

-- Trigger melhorado para auditoria de mudanças em campos sensíveis
CREATE OR REPLACE FUNCTION log_profile_sensitive_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (
    OLD.profile_status IS DISTINCT FROM NEW.profile_status OR
    OLD.comando_id IS DISTINCT FROM NEW.comando_id OR
    OLD.regional_id IS DISTINCT FROM NEW.regional_id OR
    OLD.divisao_id IS DISTINCT FROM NEW.divisao_id OR
    OLD.cargo_id IS DISTINCT FROM NEW.cargo_id OR
    OLD.funcao_id IS DISTINCT FROM NEW.funcao_id
  ) THEN
    INSERT INTO public.profile_history (
      profile_id,
      status_anterior,
      status_novo,
      observacao,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.profile_status,
      NEW.profile_status,
      'Mudança em campos sensíveis detectada: ' || 
      CASE 
        WHEN OLD.comando_id IS DISTINCT FROM NEW.comando_id THEN 'comando, '
        ELSE ''
      END ||
      CASE 
        WHEN OLD.regional_id IS DISTINCT FROM NEW.regional_id THEN 'regional, '
        ELSE ''
      END ||
      CASE 
        WHEN OLD.divisao_id IS DISTINCT FROM NEW.divisao_id THEN 'divisao, '
        ELSE ''
      END ||
      CASE 
        WHEN OLD.cargo_id IS DISTINCT FROM NEW.cargo_id THEN 'cargo, '
        ELSE ''
      END ||
      CASE 
        WHEN OLD.funcao_id IS DISTINCT FROM NEW.funcao_id THEN 'funcao'
        ELSE ''
      END,
      COALESCE((auth.uid())::text, 'system')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_profile_sensitive_changes ON public.profiles;
CREATE TRIGGER audit_profile_sensitive_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_sensitive_changes();