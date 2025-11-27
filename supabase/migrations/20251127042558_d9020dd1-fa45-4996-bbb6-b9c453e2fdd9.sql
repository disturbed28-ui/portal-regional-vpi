-- ============================================
-- Migração: Normalizar divisao_texto em mensalidades_atraso
-- Objetivo: Remover acentos para bater com divisoes.nome
-- ============================================

-- Função auxiliar para remover acentos
CREATE OR REPLACE FUNCTION normalizar_divisao_texto(texto TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN unaccent(texto);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Atualizar registros existentes removendo acentos
-- Principais divisões identificadas:

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Jacarei Centro - SP'
WHERE divisao_texto ILIKE '%Jacareí Centro%' OR divisao_texto ILIKE '%Jacarei Centro%';

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Cacapava - SP'
WHERE divisao_texto ILIKE '%Caçapava%' OR divisao_texto ILIKE '%Cacapava%';

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Sao Jose dos Campos Centro - SP'
WHERE divisao_texto ILIKE '%São José dos Campos Centro%' OR divisao_texto ILIKE '%Sao Jose dos Campos Centro%';

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Sao Jose dos Campos Sul - SP'
WHERE divisao_texto ILIKE '%São José dos Campos Sul%' OR divisao_texto ILIKE '%Sao Jose dos Campos Sul%';

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Sao Jose dos Campos Leste - SP'
WHERE divisao_texto ILIKE '%São José dos Campos Leste%' OR divisao_texto ILIKE '%Sao Jose dos Campos Leste%';

UPDATE mensalidades_atraso 
SET divisao_texto = 'Divisao Taubate - SP'
WHERE divisao_texto ILIKE '%Taubaté%' OR divisao_texto ILIKE '%Taubate%';

-- Normalizar todas as outras divisões usando a função unaccent
UPDATE mensalidades_atraso 
SET divisao_texto = normalizar_divisao_texto(divisao_texto)
WHERE divisao_texto != normalizar_divisao_texto(divisao_texto);

-- Criar índice para melhorar performance nas queries
CREATE INDEX IF NOT EXISTS idx_mensalidades_divisao_texto ON mensalidades_atraso(divisao_texto);

-- Log de resultados
DO $$
DECLARE
  total_atualizados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_atualizados
  FROM mensalidades_atraso
  WHERE ativo = true;
  
  RAISE NOTICE 'Migração concluída. Total de registros ativos: %', total_atualizados;
END $$;