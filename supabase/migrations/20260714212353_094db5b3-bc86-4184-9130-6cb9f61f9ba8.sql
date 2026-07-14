
CREATE TABLE public.agenda_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  calendar_id text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  ver_flag_caveira boolean NOT NULL DEFAULT false,
  ver_flag_lobo boolean NOT NULL DEFAULT false,
  ver_flag_ursinho boolean NOT NULL DEFAULT false,
  ver_grau_v_regional boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_calendars TO authenticated;
GRANT ALL ON public.agenda_calendars TO service_role;

ALTER TABLE public.agenda_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler agendas"
ON public.agenda_calendars FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin e comando podem inserir agendas"
ON public.agenda_calendars FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
);

CREATE POLICY "Admin e comando podem atualizar agendas"
ON public.agenda_calendars FOR UPDATE
TO authenticated
USING (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
)
WITH CHECK (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
);

CREATE POLICY "Admin e comando podem excluir agendas"
ON public.agenda_calendars FOR DELETE
TO authenticated
USING (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
);

CREATE TRIGGER trg_agenda_calendars_updated_at
BEFORE UPDATE ON public.agenda_calendars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.agenda_calendars (nome, calendar_id, ativo, palavras_chave, ordem)
VALUES (
  'Agenda Regional',
  '3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com',
  true,
  '{}',
  0
);
