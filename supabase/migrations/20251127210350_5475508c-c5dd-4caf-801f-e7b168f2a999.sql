-- Permitir integrante_id nulo para visitantes externos
ALTER TABLE public.presencas
  ALTER COLUMN integrante_id DROP NOT NULL;

-- Adicionar colunas para visitantes externos
ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS visitante_nome text,
  ADD COLUMN IF NOT EXISTS visitante_tipo text;

-- Adicionar constraint CHECK para garantir integridade
-- (se integrante_id é nulo, visitante_nome DEVE existir e vice-versa)
ALTER TABLE public.presencas
  ADD CONSTRAINT chk_presenca_tipo 
  CHECK (
    (integrante_id IS NOT NULL) OR 
    (visitante_nome IS NOT NULL AND visitante_tipo IS NOT NULL)
  );

-- Criar índice para performance em buscas por visitante
CREATE INDEX IF NOT EXISTS idx_presencas_visitante_nome 
  ON public.presencas(visitante_nome) 
  WHERE visitante_nome IS NOT NULL;