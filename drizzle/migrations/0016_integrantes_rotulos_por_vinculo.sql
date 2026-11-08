CREATE OR REPLACE FUNCTION public.integrantes_sincronizar_rotulos_hierarquia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  divisao_nome text;
  divisao_regional uuid;
  regional_nome text;
BEGIN
  IF NEW.divisao_id IS NOT NULL THEN
    SELECT d.nome, d.regional_id INTO divisao_nome, divisao_regional
    FROM public.divisoes d WHERE d.id = NEW.divisao_id;
    -- Do not move members or mask conflicting IDs. Only canonicalize a consistent link.
    IF divisao_nome IS NOT NULL AND divisao_regional IS NOT DISTINCT FROM NEW.regional_id THEN
      divisao_nome := upper(public.unaccent(trim(divisao_nome)));
      divisao_nome := regexp_replace(divisao_nome, '(\s*-\s*SP)+\s*$', '', 'i');
      IF divisao_nome NOT LIKE 'REGIONAL %' AND divisao_nome NOT LIKE 'DIVISAO %' THEN
        divisao_nome := 'DIVISAO ' || divisao_nome;
      END IF;
      NEW.divisao_texto := trim(divisao_nome) || ' - SP';
    END IF;
  END IF;
  IF NEW.regional_id IS NOT NULL THEN
    SELECT r.nome INTO regional_nome FROM public.regionais r WHERE r.id = NEW.regional_id;
    IF regional_nome IS NOT NULL THEN
      regional_nome := upper(public.unaccent(trim(regional_nome)));
      regional_nome := regexp_replace(regional_nome, '^(REGIONAL\s+)+', '', 'i');
      regional_nome := regexp_replace(regional_nome, '(\s*-\s*SP)+\s*$', '', 'i');
      NEW.regional_texto := 'REGIONAL ' || trim(regional_nome) || ' - SP';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.integrantes_sincronizar_rotulos_hierarquia() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_integrantes_rotulos_por_vinculo
BEFORE INSERT OR UPDATE OF divisao_id, regional_id, divisao_texto, regional_texto
ON public.integrantes_portal
FOR EACH ROW EXECUTE FUNCTION public.integrantes_sincronizar_rotulos_hierarquia();