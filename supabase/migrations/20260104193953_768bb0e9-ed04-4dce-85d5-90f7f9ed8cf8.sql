-- Adicionar coluna data_nascimento em integrantes_portal
ALTER TABLE public.integrantes_portal 
ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Índice para filtro por mês (performance)
CREATE INDEX IF NOT EXISTS idx_integrantes_portal_nascimento_mes 
ON public.integrantes_portal (EXTRACT(MONTH FROM data_nascimento))
WHERE data_nascimento IS NOT NULL AND ativo = true;

-- Comentário para documentação
COMMENT ON COLUMN public.integrantes_portal.data_nascimento 
IS 'Data de nascimento do integrante para listagem de aniversariantes';