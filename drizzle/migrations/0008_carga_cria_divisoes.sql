CREATE POLICY "Carga de integrantes cria divisoes" ON public.divisoes FOR INSERT TO authenticated
  WITH CHECK (public.user_has_screen_permission((auth.uid())::text, '/gestao-adm-integrantes-atualizacao'));
CREATE POLICY "Carga de integrantes cria regionais" ON public.regionais FOR INSERT TO authenticated
  WITH CHECK (public.user_has_screen_permission((auth.uid())::text, '/gestao-adm-integrantes-atualizacao'));