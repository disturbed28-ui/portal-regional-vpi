-- Campo para status da ação (em andamento / concluída)
ALTER TABLE acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS status_acao TEXT DEFAULT 'concluida';

-- Campo para identificar origem do registro
ALTER TABLE acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS origem_registro TEXT DEFAULT 'manual';

-- Campo para hash de deduplicação
ALTER TABLE acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS hash_deduplicacao TEXT;

-- Índice para busca de duplicatas
CREATE INDEX IF NOT EXISTS idx_acoes_sociais_hash_dedup 
ON acoes_sociais_registros(hash_deduplicacao) WHERE hash_deduplicacao IS NOT NULL;

-- Campos de rastreio de importação
ALTER TABLE acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS importado_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS importado_por TEXT;

-- Adicionar campo email_base na config regional
ALTER TABLE acoes_sociais_config_regional 
ADD COLUMN IF NOT EXISTS email_base TEXT;

-- Atualizar o registro existente (Vale do Paraíba 1)
UPDATE acoes_sociais_config_regional 
SET email_base = 'social.regional.vp1' 
WHERE regional_texto ILIKE '%vale%paraiba%1%' 
   OR regional_texto ILIKE '%vale%paraiba%i%';