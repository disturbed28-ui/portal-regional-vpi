-- Liga automaticamente o tipo do evento ao peso usado na frequência ponderada.
-- Sem isso, eventos_agenda.tipo_evento_peso ficava vazio e todos os eventos valiam o mesmo peso (1,0).

CREATE OR REPLACE FUNCTION public.eventos_set_tipo_peso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  NEW.tipo_evento_peso := NULL;

  IF NEW.tipo_evento IS NULL OR btrim(NEW.tipo_evento) = '' THEN
    RETURN NEW;
  END IF;

  v_norm := upper(unaccent(btrim(NEW.tipo_evento)));

  IF v_norm IN ('BONDE', 'BONDE INSANO') THEN
    NEW.tipo_evento_peso := 'Bonde';
  ELSE
    SELECT t.tipo INTO NEW.tipo_evento_peso
    FROM public.tipos_evento_peso t
    WHERE t.ativo
      AND upper(unaccent(t.tipo)) = v_norm
    ORDER BY t.ordem
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.eventos_set_tipo_peso() IS
  'Resolve o peso de frequência (tipo_evento_peso) a partir do tipo do evento, comparando sem acentos e sem diferenciar maiúsculas/minúsculas.';

DROP TRIGGER IF EXISTS trg_eventos_set_tipo_peso ON public.eventos_agenda;

CREATE TRIGGER trg_eventos_set_tipo_peso
  BEFORE INSERT OR UPDATE OF tipo_evento ON public.eventos_agenda
  FOR EACH ROW
  EXECUTE FUNCTION public.eventos_set_tipo_peso();