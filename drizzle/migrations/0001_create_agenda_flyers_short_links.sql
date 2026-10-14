CREATE TABLE public.agenda_flyers (
  code TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.agenda_flyers TO service_role;

ALTER TABLE public.agenda_flyers ENABLE ROW LEVEL SECURITY;

-- Sem políticas: acesso exclusivo via service_role (edge functions)