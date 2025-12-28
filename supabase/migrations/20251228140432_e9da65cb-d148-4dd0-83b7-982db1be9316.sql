-- Parte 1: Correção imediata - Sincronizar profiles com integrantes_portal
UPDATE profiles p
SET 
  regional_id = ip.regional_id,
  divisao_id = ip.divisao_id,
  updated_at = NOW()
FROM integrantes_portal ip
WHERE ip.profile_id = p.id
  AND ip.ativo = true
  AND (
    p.regional_id IS DISTINCT FROM ip.regional_id
    OR p.divisao_id IS DISTINCT FROM ip.divisao_id
  );

-- Parte 3: Trigger de sincronização automática
CREATE OR REPLACE FUNCTION sync_profile_from_integrante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só sincronizar se houver profile_id
  IF NEW.profile_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      regional_id = NEW.regional_id,
      divisao_id = NEW.divisao_id,
      updated_at = NOW()
    WHERE id = NEW.profile_id
      AND (
        regional_id IS DISTINCT FROM NEW.regional_id
        OR divisao_id IS DISTINCT FROM NEW.divisao_id
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para INSERT e UPDATE de campos relevantes
DROP TRIGGER IF EXISTS tr_sync_profile_on_integrante_update ON integrantes_portal;

CREATE TRIGGER tr_sync_profile_on_integrante_update
  AFTER INSERT OR UPDATE OF regional_id, divisao_id, profile_id
  ON integrantes_portal
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_from_integrante();