CREATE OR REPLACE FUNCTION public.fn_mensalidades_set_regional()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.divisao_id IS NULL THEN
    SELECT d.id, d.regional_id
    INTO NEW.divisao_id, NEW.regional_id
    FROM public.divisoes d
    WHERE upper(trim(d.nome)) = upper(trim(NEW.divisao_texto))
    LIMIT 1;
  ELSIF NEW.divisao_id IS NOT NULL THEN
    SELECT d.regional_id
    INTO NEW.regional_id
    FROM public.divisoes d
    WHERE d.id = NEW.divisao_id;
  END IF;

  RETURN NEW;
END;
$$;