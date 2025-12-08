-- 1. Trigger para atualizar last_access_at automaticamente
CREATE OR REPLACE FUNCTION public.update_last_access_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles 
  SET last_access_at = NEW.created_at 
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_access_at
  AFTER INSERT ON user_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_access_at();

-- 2. Trigger para limpeza automática de logs > 60 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_access_logs_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Limpar registros antigos em ~1% das inserções para diluir carga
  IF random() < 0.01 THEN
    DELETE FROM user_access_logs 
    WHERE created_at < NOW() - INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_old_access_logs
  AFTER INSERT ON user_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_access_logs_on_insert();