-- Função que popula nome_colete_ascii automaticamente
CREATE OR REPLACE FUNCTION public.populate_nome_colete_ascii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Popular nome_colete_ascii com versão sem acentos e em maiúsculas
  NEW.nome_colete_ascii = UPPER(unaccent(NEW.nome_colete));
  RETURN NEW;
END;
$$;

-- Trigger que executa antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_populate_nome_colete_ascii ON integrantes_portal;

CREATE TRIGGER trg_populate_nome_colete_ascii
  BEFORE INSERT OR UPDATE OF nome_colete
  ON integrantes_portal
  FOR EACH ROW
  EXECUTE FUNCTION populate_nome_colete_ascii();

-- Atualizar registros existentes que estão com nome_colete_ascii NULL
UPDATE integrantes_portal 
SET nome_colete_ascii = UPPER(unaccent(nome_colete))
WHERE nome_colete_ascii IS NULL OR nome_colete_ascii = '';