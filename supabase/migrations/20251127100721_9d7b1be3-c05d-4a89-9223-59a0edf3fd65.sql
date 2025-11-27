-- ETAPA 1: Normalização de Regionais, Divisões e Integrantes
-- Adiciona campos nome_ascii, slug e divisao_id para melhorar filtros e eliminar dependência de acentuação

-- =============================================
-- 1.1 TABELA REGIONAIS - Adicionar campos normalizados
-- =============================================
ALTER TABLE regionais ADD COLUMN IF NOT EXISTS nome_ascii TEXT;
ALTER TABLE regionais ADD COLUMN IF NOT EXISTS slug TEXT;

-- Popular nome_ascii e slug baseados no nome existente
UPDATE regionais SET 
  nome_ascii = UPPER(unaccent(nome)),
  slug = REPLACE(REPLACE(UPPER(unaccent(nome)), ' - ', '_'), ' ', '_')
WHERE nome_ascii IS NULL OR slug IS NULL;

-- Criar índice único para slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_regionais_slug ON regionais(slug);

-- =============================================
-- 1.2 TABELA DIVISOES - Adicionar campos normalizados
-- =============================================
ALTER TABLE divisoes ADD COLUMN IF NOT EXISTS nome_ascii TEXT;
ALTER TABLE divisoes ADD COLUMN IF NOT EXISTS slug TEXT;

-- Popular nome_ascii e slug
UPDATE divisoes SET 
  nome_ascii = UPPER(unaccent(nome)),
  slug = REPLACE(REPLACE(UPPER(unaccent(nome)), ' - ', '_'), ' ', '_')
WHERE nome_ascii IS NULL OR slug IS NULL;

-- Criar índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_divisoes_slug ON divisoes(slug);
CREATE INDEX IF NOT EXISTS idx_divisoes_nome_ascii ON divisoes(nome_ascii);

-- =============================================
-- 1.3 TABELA INTEGRANTES_PORTAL - Adicionar relacionamentos por ID
-- =============================================
ALTER TABLE integrantes_portal ADD COLUMN IF NOT EXISTS nome_colete_ascii TEXT;
ALTER TABLE integrantes_portal ADD COLUMN IF NOT EXISTS divisao_id UUID REFERENCES divisoes(id);
ALTER TABLE integrantes_portal ADD COLUMN IF NOT EXISTS regional_id UUID REFERENCES regionais(id);

-- Popular nome_colete_ascii
UPDATE integrantes_portal SET 
  nome_colete_ascii = UPPER(unaccent(nome_colete))
WHERE nome_colete_ascii IS NULL;

-- Popular divisao_id (match por nome normalizado)
UPDATE integrantes_portal ip SET 
  divisao_id = d.id
FROM divisoes d 
WHERE UPPER(unaccent(ip.divisao_texto)) = UPPER(unaccent(d.nome))
  AND ip.divisao_id IS NULL;

-- Popular regional_id através da divisão
UPDATE integrantes_portal ip SET 
  regional_id = d.regional_id
FROM divisoes d 
WHERE ip.divisao_id = d.id
  AND ip.regional_id IS NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_integrantes_portal_divisao_id ON integrantes_portal(divisao_id);
CREATE INDEX IF NOT EXISTS idx_integrantes_portal_regional_id ON integrantes_portal(regional_id);
CREATE INDEX IF NOT EXISTS idx_integrantes_portal_nome_colete_ascii ON integrantes_portal(nome_colete_ascii);

-- =============================================
-- 1.4 TABELA MENSALIDADES_ATRASO - Adicionar divisao_id
-- =============================================
ALTER TABLE mensalidades_atraso ADD COLUMN IF NOT EXISTS divisao_id UUID REFERENCES divisoes(id);

-- Popular divisao_id via registro_id -> integrantes_portal (método principal)
UPDATE mensalidades_atraso ma SET 
  divisao_id = ip.divisao_id
FROM integrantes_portal ip 
WHERE ma.registro_id = ip.registro_id
  AND ip.divisao_id IS NOT NULL
  AND ma.divisao_id IS NULL;

-- Fallback: Popular divisao_id via match de texto normalizado (para registros sem vínculo)
UPDATE mensalidades_atraso ma SET 
  divisao_id = d.id
FROM divisoes d 
WHERE ma.divisao_id IS NULL
  AND UPPER(unaccent(ma.divisao_texto)) = UPPER(unaccent(d.nome));

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_mensalidades_atraso_divisao_id ON mensalidades_atraso(divisao_id);

-- =============================================
-- 1.5 TABELA INTEGRANTES_AFASTADOS - Adicionar divisao_id
-- =============================================
ALTER TABLE integrantes_afastados ADD COLUMN IF NOT EXISTS divisao_id UUID REFERENCES divisoes(id);

-- Popular via registro_id -> integrantes_portal
UPDATE integrantes_afastados ia SET 
  divisao_id = ip.divisao_id
FROM integrantes_portal ip 
WHERE ia.registro_id = ip.registro_id
  AND ip.divisao_id IS NOT NULL
  AND ia.divisao_id IS NULL;

-- Fallback por texto normalizado
UPDATE integrantes_afastados ia SET 
  divisao_id = d.id
FROM divisoes d 
WHERE ia.divisao_id IS NULL
  AND UPPER(unaccent(ia.divisao_texto)) = UPPER(unaccent(d.nome));

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_integrantes_afastados_divisao_id ON integrantes_afastados(divisao_id);

-- =============================================
-- 1.6 TABELA DELTAS_PENDENTES - Adicionar divisao_id
-- =============================================
ALTER TABLE deltas_pendentes ADD COLUMN IF NOT EXISTS divisao_id UUID REFERENCES divisoes(id);

-- Popular via registro_id -> integrantes_portal
UPDATE deltas_pendentes dp SET 
  divisao_id = ip.divisao_id
FROM integrantes_portal ip 
WHERE dp.registro_id = ip.registro_id
  AND ip.divisao_id IS NOT NULL
  AND dp.divisao_id IS NULL;

-- Fallback por texto normalizado
UPDATE deltas_pendentes dp SET 
  divisao_id = d.id
FROM divisoes d 
WHERE dp.divisao_id IS NULL
  AND UPPER(unaccent(dp.divisao_texto)) = UPPER(unaccent(d.nome));

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_deltas_pendentes_divisao_id ON deltas_pendentes(divisao_id);