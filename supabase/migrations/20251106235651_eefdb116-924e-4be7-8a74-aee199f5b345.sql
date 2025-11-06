-- 1. Adicionar coluna tipo_carga (nullable temporariamente)
ALTER TABLE cargas_historico 
ADD COLUMN tipo_carga TEXT;

-- 2. Atualizar registros existentes baseado no snapshot
-- Se tem divisoes = integrantes, se tem afastados = afastados
UPDATE cargas_historico 
SET tipo_carga = CASE
  WHEN dados_snapshot ? 'divisoes' 
    AND jsonb_typeof(dados_snapshot->'divisoes') = 'array'
    AND jsonb_array_length(dados_snapshot->'divisoes') > 0 
    THEN 'integrantes'
  WHEN dados_snapshot ? 'afastados'
    AND jsonb_typeof(dados_snapshot->'afastados') = 'array'
    THEN 'afastados'
  ELSE 'outros'
END;

-- 3. Tornar NOT NULL com default
ALTER TABLE cargas_historico 
ALTER COLUMN tipo_carga SET NOT NULL,
ALTER COLUMN tipo_carga SET DEFAULT 'integrantes';

-- 4. Adicionar constraint para valores válidos
ALTER TABLE cargas_historico 
ADD CONSTRAINT check_tipo_carga 
CHECK (tipo_carga IN ('integrantes', 'afastados', 'outros'));

-- 5. Criar índice para melhorar performance das queries
CREATE INDEX idx_cargas_historico_tipo_carga 
ON cargas_historico(tipo_carga);

-- 6. Criar índice composto para queries de evolução histórica
CREATE INDEX idx_cargas_historico_tipo_data 
ON cargas_historico(tipo_carga, data_carga DESC);