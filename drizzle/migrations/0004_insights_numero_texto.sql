ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS numero_insight_texto TEXT;

UPDATE public.insights
SET numero_insight_texto = numero_insight::text
WHERE numero_insight_texto IS NULL AND numero_insight IS NOT NULL;

ALTER TABLE public.insights ALTER COLUMN numero_insight_texto SET NOT NULL;

COMMENT ON COLUMN public.insights.numero_insight IS 'DEPRECATED: use numero_insight_texto (texto livre, ex.: 13.1, S1); esta coluna numerica mantem a ordenacao dos numeros simples.';
