
CREATE OR REPLACE FUNCTION public.delete_conversation(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me TEXT;
BEGIN
  _me := (auth.uid())::text;
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_conversation_participant(_conversation_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta conversa';
  END IF;

  DELETE FROM public.messages WHERE conversation_id = _conversation_id;
  DELETE FROM public.conversations WHERE id = _conversation_id;

  RETURN TRUE;
END;
$function$;
