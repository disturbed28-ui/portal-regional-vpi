CREATE OR REPLACE FUNCTION public.resolver_cargo_id_integrante(
  p_cargo_grau_texto text,
  p_cargo_nome text,
  p_grau text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cargo_id uuid;
  v_norm_grau_texto text;
  v_norm_nome text;
  v_base_nome text;
BEGIN
  v_norm_grau_texto := public.cargo_normalize(p_cargo_grau_texto);
  v_norm_nome := public.cargo_normalize(p_cargo_nome);
  v_base_nome := public.cargo_normalize(
    regexp_replace(coalesce(p_cargo_nome, p_cargo_grau_texto, ''), '\s*\(Grau\s+[IVX]+\).*$', '', 'i')
  );

  IF v_norm_grau_texto = '' AND v_norm_nome = '' AND v_base_nome = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Correspondência exata normalizada com cargos.nome
  SELECT c.id INTO v_cargo_id
  FROM public.cargos c
  WHERE (v_norm_grau_texto <> '' AND public.cargo_normalize(c.nome) = v_norm_grau_texto)
     OR (v_norm_nome <> '' AND public.cargo_normalize(c.nome) = v_norm_nome)
  ORDER BY CASE WHEN public.cargo_normalize(c.nome) = v_norm_grau_texto THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_cargo_id IS NOT NULL THEN
    RETURN v_cargo_id;
  END IF;

  -- 2. Correspondência pelo nome base (sem "(Grau ...)") + grau
  IF v_base_nome <> '' THEN
    SELECT c.id INTO v_cargo_id
    FROM public.cargos c
    WHERE public.cargo_normalize(regexp_replace(c.nome, '\s*\(Grau\s+[IVX]+\)\s*$', '', 'i')) = v_base_nome
      AND (p_grau IS NULL OR c.grau = p_grau)
    LIMIT 1;

    IF v_cargo_id IS NOT NULL THEN
      RETURN v_cargo_id;
    END IF;
  END IF;

  -- 3. Fallback para cargos de Grau VIII / IX sem linha própria (ex.: Sgt Armas Full / Meio)
  IF p_grau IN ('VIII', 'IX') THEN
    SELECT c.id INTO v_cargo_id
    FROM public.cargos c
    WHERE c.grau = p_grau
    ORDER BY c.nome
    LIMIT 1;
  END IF;

  RETURN v_cargo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_from_integrante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comando_id uuid;
  v_cargo_id uuid;
BEGIN
  IF NEW.profile_id IS NOT NULL AND COALESCE(NEW.ativo, true) THEN
    IF NEW.regional_id IS NOT NULL THEN
      SELECT r.comando_id INTO v_comando_id
      FROM public.regionais r
      WHERE r.id = NEW.regional_id;
    END IF;

    v_cargo_id := public.resolver_cargo_id_integrante(
      NEW.cargo_grau_texto,
      NEW.cargo_nome,
      NEW.grau
    );

    UPDATE public.profiles
    SET
      regional_id = NEW.regional_id,
      divisao_id = NEW.divisao_id,
      comando_id = COALESCE(v_comando_id, comando_id),
      cargo_id = COALESCE(v_cargo_id, cargo_id),
      grau = COALESCE(NEW.grau, grau),
      data_entrada = COALESCE(NEW.data_entrada, data_entrada),
      updated_at = NOW()
    WHERE id = NEW.profile_id
      AND (
        regional_id IS DISTINCT FROM NEW.regional_id
        OR divisao_id IS DISTINCT FROM NEW.divisao_id
        OR (v_comando_id IS NOT NULL AND comando_id IS DISTINCT FROM v_comando_id)
        OR (v_cargo_id IS NOT NULL AND cargo_id IS DISTINCT FROM v_cargo_id)
        OR (NEW.grau IS NOT NULL AND grau IS DISTINCT FROM NEW.grau)
        OR (NEW.data_entrada IS NOT NULL AND data_entrada IS DISTINCT FROM NEW.data_entrada)
      );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_sync_profile_on_integrante_update ON public.integrantes_portal;

CREATE TRIGGER tr_sync_profile_on_integrante_update
AFTER INSERT OR UPDATE OF regional_id, divisao_id, profile_id, cargo_grau_texto, cargo_nome, grau, data_entrada, ativo
ON public.integrantes_portal
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_from_integrante();