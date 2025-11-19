-- Adicionar policy de UPDATE para permitir usuário editar seus próprios relatórios
CREATE POLICY "Usuarios podem atualizar seus relatorios semanais"
  ON public.relatorios_semanais_divisao
  FOR UPDATE
  USING (
    profile_id = (auth.uid())::text
  )
  WITH CHECK (
    profile_id = (auth.uid())::text
  );

COMMENT ON POLICY "Usuarios podem atualizar seus relatorios semanais" 
  ON public.relatorios_semanais_divisao 
  IS 'Permite usuários atualizarem seus próprios relatórios quando limite_respostas = multipla';