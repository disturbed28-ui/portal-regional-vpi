-- Função que mantém ativo coerente com data_inativacao + motivo_inativacao
CREATE OR REPLACE FUNCTION public.sync_ativo_with_inativacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se ambos data_inativacao e motivo_inativacao estão preenchidos
  -- com motivo terminal, forçar ativo = false
  IF NEW.data_inativacao IS NOT NULL 
     AND NEW.motivo_inativacao IS NOT NULL
     AND NEW.motivo_inativacao::text IN ('desligado', 'transferido', 'outro') THEN
    NEW.ativo := false;
  END IF;

  -- Se motivo é 'afastado', integrante deve permanecer ativo
  -- (afastamento é tratado via tabela integrantes_afastados)
  IF NEW.motivo_inativacao IS NOT NULL 
     AND NEW.motivo_inativacao::text = 'afastado' THEN
    NEW.ativo := true;
  END IF;

  -- Se ambos campos foram limpos, garantir ativo = true
  IF NEW.data_inativacao IS NULL AND NEW.motivo_inativacao IS NULL THEN
    NEW.ativo := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_sync_ativo_inativacao ON public.integrantes_portal;
CREATE TRIGGER trg_sync_ativo_inativacao
BEFORE INSERT OR UPDATE OF ativo, data_inativacao, motivo_inativacao
ON public.integrantes_portal
FOR EACH ROW
EXECUTE FUNCTION public.sync_ativo_with_inativacao();