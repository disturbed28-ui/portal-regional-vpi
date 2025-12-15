-- Preencher divisao_id nos registros de mensalidades_atraso
-- Matching por divisao_texto (sem acentos) com a tabela divisoes

UPDATE mensalidades_atraso ma
SET divisao_id = d.id
FROM divisoes d
WHERE LOWER(unaccent(TRIM(ma.divisao_texto))) = LOWER(unaccent(TRIM(d.nome)))
  AND ma.divisao_id IS NULL;

-- Log de quantos foram atualizados
DO $$
DECLARE
  count_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_updated
  FROM mensalidades_atraso
  WHERE divisao_id IS NOT NULL;
  
  RAISE NOTICE 'Mensalidades com divisao_id preenchido: %', count_updated;
END $$;