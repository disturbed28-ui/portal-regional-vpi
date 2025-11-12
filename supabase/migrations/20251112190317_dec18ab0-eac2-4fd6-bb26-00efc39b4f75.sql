-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Function Search Path Mutable
-- ============================================================================
-- Adicionar search_path às funções que não possuem para evitar vulnerabilidades

-- Função: cargo_normalize (adicionar search_path)
CREATE OR REPLACE FUNCTION public.cargo_normalize(cargo_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF cargo_texto IS NULL OR TRIM(cargo_texto) = '' THEN
    RETURN '';
  END IF;
  
  RETURN LOWER(TRIM(REGEXP_REPLACE(
    UNACCENT(cargo_texto),
    '[^a-zA-Z0-9 ]',
    '',
    'g'
  )));
END;
$$;

-- Função: update_cargo_role_mapping_updated_at (adicionar search_path)
CREATE OR REPLACE FUNCTION public.update_cargo_role_mapping_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;