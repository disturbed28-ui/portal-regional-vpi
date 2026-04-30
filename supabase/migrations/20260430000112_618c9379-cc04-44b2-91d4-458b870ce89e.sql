
-- ============================================================================
-- CHAT 1:1 SCHEMA
-- ============================================================================

-- Conversations: representa uma conversa entre dois usuários
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_a TEXT NOT NULL,
  participant_b TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- canonical order: participant_a < participant_b para garantir uniqueness
  CONSTRAINT participants_ordered CHECK (participant_a < participant_b),
  CONSTRAINT participants_distinct CHECK (participant_a <> participant_b),
  CONSTRAINT unique_pair UNIQUE (participant_a, participant_b)
);

CREATE INDEX idx_conversations_participant_a ON public.conversations(participant_a, last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_participant_b ON public.conversations(participant_b, last_message_at DESC NULLS LAST);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(conversation_id, sender_id) WHERE read_at IS NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Helper: verifica se o usuário atual é participante da conversa
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND ((auth.uid())::text IN (c.participant_a, c.participant_b))
  )
$$;

-- Trigger: atualiza last_message_at e preview na conversa após nova mensagem
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 120),
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();

-- Trigger genérico de updated_at na conversations
CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: obter ou criar conversa entre dois usuários (ordena par canonicamente)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me TEXT;
  _a TEXT;
  _b TEXT;
  _conv_id UUID;
BEGIN
  _me := (auth.uid())::text;

  IF _me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = _me THEN
    RAISE EXCEPTION 'Destinatário inválido';
  END IF;

  -- Validar que o outro user existe e está ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _other_user_id
      AND p.profile_status = 'Ativo'
  ) THEN
    RAISE EXCEPTION 'Destinatário não está ativo';
  END IF;

  -- Validar que eu também estou ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _me
      AND p.profile_status = 'Ativo'
  ) THEN
    RAISE EXCEPTION 'Apenas usuários ativos podem iniciar conversas';
  END IF;

  -- Ordenar canonicamente
  IF _me < _other_user_id THEN
    _a := _me; _b := _other_user_id;
  ELSE
    _a := _other_user_id; _b := _me;
  END IF;

  -- Tentar encontrar
  SELECT id INTO _conv_id
  FROM public.conversations
  WHERE participant_a = _a AND participant_b = _b;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  -- Criar
  INSERT INTO public.conversations (participant_a, participant_b)
  VALUES (_a, _b)
  RETURNING id INTO _conv_id;

  RETURN _conv_id;
END;
$$;

-- RPC: marcar mensagens como lidas em uma conversa
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me TEXT;
  _updated INTEGER;
BEGIN
  _me := (auth.uid())::text;
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_conversation_participant(_conversation_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = _conversation_id
    AND sender_id <> _me
    AND read_at IS NULL;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

-- RPC: contar mensagens não lidas (total para o usuário atual)
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS INTEGER
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.read_at IS NULL
    AND m.sender_id <> (auth.uid())::text
    AND ((auth.uid())::text IN (c.participant_a, c.participant_b));
$$;

-- ============================================================================
-- RLS POLICIES (privacidade TOTAL — nem admin lê)
-- ============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- conversations: apenas participantes
CREATE POLICY "Participantes veem suas conversas"
ON public.conversations FOR SELECT
TO authenticated
USING ((auth.uid())::text IN (participant_a, participant_b));

CREATE POLICY "Participantes podem criar conversas"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK ((auth.uid())::text IN (participant_a, participant_b));

CREATE POLICY "Participantes podem atualizar conversas"
ON public.conversations FOR UPDATE
TO authenticated
USING ((auth.uid())::text IN (participant_a, participant_b))
WITH CHECK ((auth.uid())::text IN (participant_a, participant_b));

-- messages: apenas participantes da conversa
CREATE POLICY "Participantes veem mensagens da conversa"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Participantes podem enviar mensagens"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (auth.uid())::text
  AND public.is_conversation_participant(conversation_id)
);

CREATE POLICY "Destinatario pode marcar como lida"
ON public.messages FOR UPDATE
TO authenticated
USING (
  public.is_conversation_participant(conversation_id)
  AND sender_id <> (auth.uid())::text
)
WITH CHECK (
  public.is_conversation_participant(conversation_id)
  AND sender_id <> (auth.uid())::text
);

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
