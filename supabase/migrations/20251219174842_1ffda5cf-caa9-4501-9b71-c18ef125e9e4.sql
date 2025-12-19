-- =======================================================
-- NORMALIZAÇÃO COMPLETA: Dados existentes + Trigger
-- =======================================================

-- 1. Normalizar tabela divisoes
UPDATE divisoes
SET nome = UPPER(
  TRANSLATE(COALESCE(nome, ''), 
    'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ', 
    'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
  )
)
WHERE nome IS NOT NULL;

-- 2. Normalizar tabela regionais
UPDATE regionais
SET nome = UPPER(
  TRANSLATE(COALESCE(nome, ''), 
    'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ', 
    'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
  )
)
WHERE nome IS NOT NULL;

-- 3. Normalizar integrantes_portal.divisao_texto
UPDATE integrantes_portal
SET divisao_texto = UPPER(
  TRANSLATE(COALESCE(divisao_texto, ''), 
    'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ', 
    'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
  )
)
WHERE divisao_texto IS NOT NULL;

-- 4. Normalizar integrantes_portal.regional_texto
UPDATE integrantes_portal
SET regional_texto = UPPER(
  TRANSLATE(COALESCE(regional_texto, ''), 
    'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ', 
    'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
  )
)
WHERE regional_texto IS NOT NULL;

-- 5. Normalizar integrantes_portal.comando_texto
UPDATE integrantes_portal
SET comando_texto = UPPER(
  TRANSLATE(COALESCE(comando_texto, ''), 
    'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ', 
    'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
  )
)
WHERE comando_texto IS NOT NULL;

-- 6. Criar função de normalização para trigger
CREATE OR REPLACE FUNCTION public.normalize_hierarquia_texto()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar divisao_texto
  IF NEW.divisao_texto IS NOT NULL THEN
    NEW.divisao_texto := UPPER(
      TRANSLATE(
        NEW.divisao_texto,
        'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
        'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
      )
    );
  END IF;
  
  -- Normalizar regional_texto
  IF NEW.regional_texto IS NOT NULL THEN
    NEW.regional_texto := UPPER(
      TRANSLATE(
        NEW.regional_texto,
        'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
        'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
      )
    );
  END IF;
  
  -- Normalizar comando_texto
  IF NEW.comando_texto IS NOT NULL THEN
    NEW.comando_texto := UPPER(
      TRANSLATE(
        NEW.comando_texto,
        'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
        'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Criar trigger
DROP TRIGGER IF EXISTS trg_normalize_integrantes ON integrantes_portal;
CREATE TRIGGER trg_normalize_integrantes
BEFORE INSERT OR UPDATE ON integrantes_portal
FOR EACH ROW EXECUTE FUNCTION public.normalize_hierarquia_texto();