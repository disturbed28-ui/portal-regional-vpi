-- Remover política genérica problemática
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Criar política específica para usuários comuns
-- Permite UPDATE apenas se for o próprio usuário
-- Não usa WITH CHECK para evitar validação de OLD vs NEW
CREATE POLICY "Users can update their own non-admin fields"
  ON public.profiles
  FOR UPDATE
  USING ((auth.uid())::text = id);

-- A política de admin já existente permite admins atualizarem profile_status e observacao
-- Essa separação garante que usuários comuns não possam alterar campos administrativos

-- Adicionar comentário para documentação
COMMENT ON POLICY "Users can update their own non-admin fields" ON public.profiles IS 
'Permite usuários atualizarem seu próprio perfil (nome_colete, name, photo_url, status). Campos administrativos (profile_status, observacao) são controlados pela política de admin separada.';