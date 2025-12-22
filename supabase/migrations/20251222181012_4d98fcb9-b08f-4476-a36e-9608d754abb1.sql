-- ==========================================
-- PARTE 1: Atualizar trigger de integrantes_portal para normalização completa
-- ==========================================

CREATE OR REPLACE FUNCTION public.normalize_hierarquia_texto()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar divisao_texto
  IF NEW.divisao_texto IS NOT NULL THEN
    NEW.divisao_texto := UPPER(TRANSLATE(NEW.divisao_texto, 
      'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
      'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'));
    
    -- Adicionar prefixo DIVISAO se não tiver (mas manter REGIONAL se já tiver)
    IF NEW.divisao_texto NOT LIKE 'DIVISAO %' 
       AND NEW.divisao_texto NOT LIKE 'REGIONAL %' THEN
      NEW.divisao_texto := 'DIVISAO ' || NEW.divisao_texto;
    END IF;
    
    -- Garantir sufixo - SP
    IF NEW.divisao_texto NOT LIKE '% - SP' THEN
      NEW.divisao_texto := REGEXP_REPLACE(NEW.divisao_texto, '\s*-?\s*SP?\s*$', '') || ' - SP';
    END IF;
  END IF;
  
  -- Normalizar regional_texto
  IF NEW.regional_texto IS NOT NULL THEN
    NEW.regional_texto := UPPER(TRANSLATE(NEW.regional_texto, 
      'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
      'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'));
    
    -- Adicionar prefixo REGIONAL se não tiver
    IF NEW.regional_texto NOT LIKE 'REGIONAL %' THEN
      NEW.regional_texto := 'REGIONAL ' || REGEXP_REPLACE(NEW.regional_texto, '^REGIONAL\s*', '');
    END IF;
    
    -- Garantir sufixo - SP
    IF NEW.regional_texto NOT LIKE '% - SP' THEN
      NEW.regional_texto := REGEXP_REPLACE(NEW.regional_texto, '\s*-?\s*SP?\s*$', '') || ' - SP';
    END IF;
  END IF;
  
  -- Normalizar comando_texto
  IF NEW.comando_texto IS NOT NULL THEN
    NEW.comando_texto := UPPER(TRANSLATE(NEW.comando_texto, 
      'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
      'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'));
    
    -- Adicionar prefixo COMANDO se não tiver
    IF NEW.comando_texto NOT LIKE 'COMANDO %' THEN
      NEW.comando_texto := 'COMANDO ' || REGEXP_REPLACE(NEW.comando_texto, '^COMANDO\s*', '');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- PARTE 2: Criar trigger para mensalidades_atraso
-- ==========================================

CREATE OR REPLACE FUNCTION public.normalize_mensalidades_texto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.divisao_texto IS NOT NULL THEN
    NEW.divisao_texto := UPPER(TRANSLATE(NEW.divisao_texto, 
      'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
      'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'));
    
    IF NEW.divisao_texto NOT LIKE 'DIVISAO %' 
       AND NEW.divisao_texto NOT LIKE 'REGIONAL %' THEN
      NEW.divisao_texto := 'DIVISAO ' || NEW.divisao_texto;
    END IF;
    
    IF NEW.divisao_texto NOT LIKE '% - SP' THEN
      NEW.divisao_texto := REGEXP_REPLACE(NEW.divisao_texto, '\s*-?\s*SP?\s*$', '') || ' - SP';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_normalize_mensalidades ON mensalidades_atraso;
CREATE TRIGGER trg_normalize_mensalidades
BEFORE INSERT OR UPDATE ON mensalidades_atraso
FOR EACH ROW EXECUTE FUNCTION public.normalize_mensalidades_texto();

-- ==========================================
-- PARTE 3: Criar trigger para integrantes_afastados
-- ==========================================

CREATE OR REPLACE FUNCTION public.normalize_afastados_texto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.divisao_texto IS NOT NULL THEN
    NEW.divisao_texto := UPPER(TRANSLATE(NEW.divisao_texto, 
      'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
      'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'));
    
    IF NEW.divisao_texto NOT LIKE 'DIVISAO %' 
       AND NEW.divisao_texto NOT LIKE 'REGIONAL %' THEN
      NEW.divisao_texto := 'DIVISAO ' || NEW.divisao_texto;
    END IF;
    
    IF NEW.divisao_texto NOT LIKE '% - SP' THEN
      NEW.divisao_texto := REGEXP_REPLACE(NEW.divisao_texto, '\s*-?\s*SP?\s*$', '') || ' - SP';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_normalize_afastados ON integrantes_afastados;
CREATE TRIGGER trg_normalize_afastados
BEFORE INSERT OR UPDATE ON integrantes_afastados
FOR EACH ROW EXECUTE FUNCTION public.normalize_afastados_texto();

-- ==========================================
-- PARTE 4: Normalizar dados existentes
-- ==========================================

-- Corrigir integrantes_portal - regional_texto sem prefixo
UPDATE integrantes_portal
SET regional_texto = 'REGIONAL ' || regional_texto
WHERE regional_texto NOT LIKE 'REGIONAL %'
  AND regional_texto IS NOT NULL
  AND regional_texto != '';

-- Corrigir integrantes_portal - regional_texto sem sufixo - SP
UPDATE integrantes_portal
SET regional_texto = REGEXP_REPLACE(regional_texto, '\s*-?\s*SP?\s*$', '') || ' - SP'
WHERE regional_texto NOT LIKE '% - SP'
  AND regional_texto IS NOT NULL
  AND regional_texto != '';

-- Corrigir mensalidades_atraso - UPPERCASE
UPDATE mensalidades_atraso
SET divisao_texto = UPPER(TRANSLATE(divisao_texto, 
  'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
  'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'))
WHERE divisao_texto IS NOT NULL
  AND divisao_texto != '';

-- Corrigir mensalidades_atraso - prefixo DIVISAO
UPDATE mensalidades_atraso
SET divisao_texto = 'DIVISAO ' || divisao_texto
WHERE divisao_texto NOT LIKE 'DIVISAO %'
  AND divisao_texto NOT LIKE 'REGIONAL %'
  AND divisao_texto IS NOT NULL
  AND divisao_texto != '';

-- Corrigir mensalidades_atraso - sufixo - SP
UPDATE mensalidades_atraso
SET divisao_texto = REGEXP_REPLACE(divisao_texto, '\s*-?\s*SP?\s*$', '') || ' - SP'
WHERE divisao_texto NOT LIKE '% - SP'
  AND divisao_texto IS NOT NULL
  AND divisao_texto != '';

-- Corrigir integrantes_afastados - UPPERCASE
UPDATE integrantes_afastados
SET divisao_texto = UPPER(TRANSLATE(divisao_texto, 
  'áéíóúàèìòùãõâêîôûäëïöüçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÄËÏÖÜÇ',
  'aeiouaeiouaoaeiouaeioucAEIOUAEIOUAOAEIOUAEIOUC'))
WHERE divisao_texto IS NOT NULL
  AND divisao_texto != '';

-- Corrigir integrantes_afastados - prefixo DIVISAO
UPDATE integrantes_afastados
SET divisao_texto = 'DIVISAO ' || divisao_texto
WHERE divisao_texto NOT LIKE 'DIVISAO %'
  AND divisao_texto NOT LIKE 'REGIONAL %'
  AND divisao_texto IS NOT NULL
  AND divisao_texto != '';

-- Corrigir integrantes_afastados - sufixo - SP
UPDATE integrantes_afastados
SET divisao_texto = REGEXP_REPLACE(divisao_texto, '\s*-?\s*SP?\s*$', '') || ' - SP'
WHERE divisao_texto NOT LIKE '% - SP'
  AND divisao_texto IS NOT NULL
  AND divisao_texto != '';