
-- 1) Colunas para controle unilateral de exclusão
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS deleted_at_a TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at_b TIMESTAMPTZ;

-- 2) Substituir delete_conversation: agora é unilateral (só marca data para o caller)
CREATE OR REPLACE FUNCTION public.delete_conversation(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me TEXT;
  _conv RECORD;
BEGIN
  _me := (auth.uid())::text;
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, participant_a, participant_b
    INTO _conv
  FROM public.conversations
  WHERE id = _conversation_id;

  IF _conv.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _me NOT IN (_conv.participant_a, _conv.participant_b) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta conversa';
  END IF;

  IF _me = _conv.participant_a THEN
    UPDATE public.conversations SET deleted_at_a = now() WHERE id = _conversation_id;
  ELSE
    UPDATE public.conversations SET deleted_at_b = now() WHERE id = _conversation_id;
  END IF;

  RETURN TRUE;
END;
$function$;

-- 3) Atualizar contagem de não lidas para respeitar o corte de exclusão do usuário
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.read_at IS NULL
    AND m.sender_id <> (auth.uid())::text
    AND ((auth.uid())::text IN (c.participant_a, c.participant_b))
    AND (
      ((auth.uid())::text = c.participant_a AND (c.deleted_at_a IS NULL OR m.created_at > c.deleted_at_a))
      OR
      ((auth.uid())::text = c.participant_b AND (c.deleted_at_b IS NULL OR m.created_at > c.deleted_at_b))
    );
$function$;

-- 4) Quando uma nova mensagem chega, "reabrir" a conversa para quem a havia apagado
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _conv RECORD;
BEGIN
  SELECT participant_a, participant_b INTO _conv
  FROM public.conversations WHERE id = NEW.conversation_id;

  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 120),
      updated_at = NEW.created_at,
      -- Limpar marca de exclusão do destinatário, para reaparecer na caixa
      deleted_at_a = CASE WHEN _conv.participant_a <> NEW.sender_id THEN NULL ELSE deleted_at_a END,
      deleted_at_b = CASE WHEN _conv.participant_b <> NEW.sender_id THEN NULL ELSE deleted_at_b END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;
