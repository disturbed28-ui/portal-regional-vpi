-- numero_insight_texto passa a ser o identificador oficial; o numero numerico fica opcional
ALTER TABLE public.insights ALTER COLUMN numero_insight DROP NOT NULL;
