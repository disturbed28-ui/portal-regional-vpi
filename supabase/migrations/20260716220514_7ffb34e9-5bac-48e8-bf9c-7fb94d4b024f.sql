
CREATE OR REPLACE FUNCTION public.user_has_screen_permission(_user_id uuid, _screen_route text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.screen_permissions sp
    JOIN public.system_screens ss ON ss.id = sp.screen_id
    JOIN public.user_roles ur
      ON ur.user_id = _user_id::text
     AND ur.role::text = sp.role::text
    WHERE ss.rota = _screen_route
  );
$$;

DROP POLICY IF EXISTS "Admin e comando podem inserir agendas" ON public.agenda_calendars;
DROP POLICY IF EXISTS "Admin e comando podem atualizar agendas" ON public.agenda_calendars;
DROP POLICY IF EXISTS "Admin e comando podem excluir agendas" ON public.agenda_calendars;

CREATE POLICY "Permissao matriz para inserir agendas"
ON public.agenda_calendars FOR INSERT TO authenticated
WITH CHECK (public.user_has_screen_permission(auth.uid(), '/gestao-adm-agendas'));

CREATE POLICY "Permissao matriz para atualizar agendas"
ON public.agenda_calendars FOR UPDATE TO authenticated
USING (public.user_has_screen_permission(auth.uid(), '/gestao-adm-agendas'))
WITH CHECK (public.user_has_screen_permission(auth.uid(), '/gestao-adm-agendas'));

CREATE POLICY "Permissao matriz para excluir agendas"
ON public.agenda_calendars FOR DELETE TO authenticated
USING (public.user_has_screen_permission(auth.uid(), '/gestao-adm-agendas'));
