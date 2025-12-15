-- Adicionar coluna regional_id na tabela mensalidades_atraso
ALTER TABLE mensalidades_atraso 
ADD COLUMN IF NOT EXISTS regional_id uuid REFERENCES regionais(id);

-- Criar índice para performance em queries por regional
CREATE INDEX IF NOT EXISTS idx_mensalidades_atraso_regional_id ON mensalidades_atraso(regional_id);

-- Preencher regional_id para registros existentes baseado na divisao_texto
UPDATE mensalidades_atraso ma
SET regional_id = d.regional_id
FROM divisoes d
WHERE unaccent(lower(ma.divisao_texto)) = unaccent(lower(d.nome))
  AND ma.regional_id IS NULL;

-- Fallback: tentar match parcial para divisões com nome diferente
UPDATE mensalidades_atraso ma
SET regional_id = d.regional_id
FROM divisoes d
WHERE ma.regional_id IS NULL
  AND unaccent(lower(ma.divisao_texto)) LIKE '%' || unaccent(lower(d.nome)) || '%';

-- Fallback 2: Buscar regional do integrante pelo registro_id
UPDATE mensalidades_atraso ma
SET regional_id = ip.regional_id
FROM integrantes_portal ip
WHERE ma.registro_id = ip.registro_id
  AND ma.regional_id IS NULL
  AND ip.regional_id IS NOT NULL;