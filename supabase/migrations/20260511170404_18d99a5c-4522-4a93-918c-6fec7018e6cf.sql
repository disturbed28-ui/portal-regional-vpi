ALTER TABLE public.cargo_responsavel_regional_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler mapping"
  ON public.cargo_responsavel_regional_mapping
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins podem gerenciar mapping"
  ON public.cargo_responsavel_regional_mapping
  FOR ALL TO authenticated
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

DROP POLICY IF EXISTS "Todos podem ver eventos" ON public.eventos_agenda;
CREATE POLICY "Autenticados podem ver eventos"
  ON public.eventos_agenda
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Todos podem ver presenças" ON public.presencas;
CREATE POLICY "Autenticados podem ver presenças"
  ON public.presencas
  FOR SELECT TO authenticated USING (true);

ALTER FUNCTION public.normalizar_divisao_texto(text) SET search_path = public;
ALTER FUNCTION public.update_updated_at_tipos_delta() SET search_path = public;
ALTER FUNCTION public.update_updated_at_acoes_delta() SET search_path = public;
ALTER FUNCTION public.update_formularios_catalogo_updated_at() SET search_path = public;
ALTER FUNCTION public.update_system_settings_updated_at() SET search_path = public;