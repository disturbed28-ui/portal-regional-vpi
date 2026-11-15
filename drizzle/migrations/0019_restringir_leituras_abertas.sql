CREATE OR REPLACE FUNCTION public.is_usuario_cadastrado()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text)
$$;
CREATE OR REPLACE FUNCTION public.is_integrante_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND profile_status = 'Ativo')
    OR public.has_role(auth.uid()::text, 'admin')
$$;

DROP POLICY IF EXISTS "Todos podem ver permissões" ON public.screen_permissions;
CREATE POLICY "Usuarios cadastrados podem ver permissões" ON public.screen_permissions FOR SELECT TO authenticated USING (public.is_usuario_cadastrado());
DROP POLICY IF EXISTS "Todos podem ler cargo_role_mapping" ON public.cargo_role_mapping;
CREATE POLICY "Usuarios cadastrados podem ler cargo_role_mapping" ON public.cargo_role_mapping FOR SELECT TO authenticated USING (public.is_usuario_cadastrado());
DROP POLICY IF EXISTS "Autenticados podem ler mapping" ON public.cargo_responsavel_regional_mapping;
CREATE POLICY "Usuarios cadastrados podem ler mapping" ON public.cargo_responsavel_regional_mapping FOR SELECT TO authenticated USING (public.is_usuario_cadastrado());

DROP POLICY IF EXISTS "Admins e regionais podem ver dispensas" ON public.dados_atualizacao_dispensa;
CREATE POLICY "Integrantes ativos podem ver dispensas" ON public.dados_atualizacao_dispensa FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Authenticated users can view integrantes_portal" ON public.integrantes_portal;
CREATE POLICY "Integrantes ativos podem ver integrantes_portal" ON public.integrantes_portal FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Autenticados podem ver presenças" ON public.presencas;
CREATE POLICY "Integrantes ativos podem ver presenças" ON public.presencas FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Usuários autenticados podem inserir histórico de estágios" ON public.estagios_historico;
CREATE POLICY "Integrantes ativos podem inserir histórico de estágios" ON public.estagios_historico FOR INSERT TO authenticated WITH CHECK (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Usuários autenticados podem ler histórico de estágios" ON public.estagios_historico;
CREATE POLICY "Integrantes ativos podem ler histórico de estágios" ON public.estagios_historico FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Authenticated can view aprovacoes_estagio" ON public.aprovacoes_estagio;
CREATE POLICY "Integrantes ativos podem ver aprovacoes_estagio" ON public.aprovacoes_estagio FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Authenticated users can view configurações acoes sociais" ON public.acoes_sociais_config_regional;
CREATE POLICY "Integrantes ativos podem ver configurações acoes sociais" ON public.acoes_sociais_config_regional FOR SELECT TO authenticated USING (public.is_integrante_ativo());
DROP POLICY IF EXISTS "Todos podem ver ações de resolução" ON public.acoes_resolucao_delta;
CREATE POLICY "Integrantes ativos podem ver ações de resolução" ON public.acoes_resolucao_delta FOR SELECT TO authenticated USING (public.is_integrante_ativo());

DROP POLICY IF EXISTS "flyers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "flyers_read_authenticated" ON storage.objects;