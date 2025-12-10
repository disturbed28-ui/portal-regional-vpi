-- Adicionar coluna sigla na tabela regionais
ALTER TABLE public.regionais ADD COLUMN sigla TEXT;

-- Criar índice único para garantir que não existam siglas duplicadas
CREATE UNIQUE INDEX idx_regionais_sigla_unique ON public.regionais(sigla) WHERE sigla IS NOT NULL;