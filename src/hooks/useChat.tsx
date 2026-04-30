import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  other_user_id: string;
  other_nome_colete: string | null;
  other_photo_url: string | null;
  unread_count: number;
}

// Som de notificação (gerado via Web Audio — sem dependência de arquivo)
let _audioCtx: AudioContext | null = null;
const playNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    // Dois bips curtos — agradáveis
    [0, 0.18].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(i === 0 ? 880 : 1175, now + delay);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    });
  } catch {
    /* silencioso */
  }
};

/**
 * Hook: contagem global de mensagens não lidas + assinatura realtime para incrementar.
 * Toca som e ativa flag `highlight` quando uma nova mensagem chega com a aba em foco.
 */
export const useUnreadMessages = (userId: string | undefined) => {
  const [count, setCount] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const prevCountRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHighlight = useCallback(() => {
    setHighlight(true);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlight(false), 4000);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_unread_messages_count");
    if (!error && typeof data === "number") {
      const next = data;
      const prev = prevCountRef.current;
      // Só toca/destaca se subiu (nova mensagem) e já tínhamos baseline
      if (initializedRef.current && next > prev) {
        const tabVisible = typeof document !== "undefined" && !document.hidden;
        if (tabVisible) {
          playNotificationSound();
          triggerHighlight();
        }
      }
      prevCountRef.current = next;
      initializedRef.current = true;
      setCount(next);
    }
  }, [userId, triggerHighlight]);

  useEffect(() => {
    if (!userId) return;
    refresh();

    // Escuta inserts/updates de mensagens — qualquer alteração refaz contagem
    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [userId, refresh]);

  return { unreadCount: count, refresh, highlight };
};

/**
 * Exclui uma conversa (mensagens + registro). Apenas participantes.
 */
export const deleteConversation = async (conversationId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("delete_conversation", {
    _conversation_id: conversationId,
  });
  if (error) {
    console.error("Erro ao excluir conversa:", error);
    return false;
  }
  return data === true;
};

/**
 * Hook: lista todas conversas do usuário com nome do outro participante e contagem não lida.
 */
export const useConversations = (userId: string | undefined) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: convs, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error || !convs) {
      setLoading(false);
      return;
    }

    // Coletar IDs dos outros participantes
    const otherIds = convs.map((c) =>
      c.participant_a === userId ? c.participant_b : c.participant_a
    );

    // Buscar perfis em batch
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome_colete, photo_url")
      .in("id", otherIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    // Buscar contagem não lida por conversa
    const { data: unreadRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .is("read_at", null)
      .neq("sender_id", userId)
      .in(
        "conversation_id",
        convs.map((c) => c.id)
      );

    const unreadMap = new Map<string, number>();
    (unreadRows ?? []).forEach((r) => {
      unreadMap.set(r.conversation_id, (unreadMap.get(r.conversation_id) ?? 0) + 1);
    });

    const summaries: ConversationSummary[] = convs.map((c) => {
      const otherId = c.participant_a === userId ? c.participant_b : c.participant_a;
      const prof = profileMap.get(otherId);
      return {
        id: c.id,
        participant_a: c.participant_a,
        participant_b: c.participant_b,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        other_user_id: otherId,
        other_nome_colete: prof?.nome_colete ?? null,
        other_photo_url: prof?.photo_url ?? null,
        unread_count: unreadMap.get(c.id) ?? 0,
      };
    });

    setConversations(summaries);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refresh();

    const channel = supabase
      .channel(`conversations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { conversations, loading, refresh };
};

/**
 * Hook: mensagens de uma conversa específica + envio + realtime + marcar como lida.
 */
export const useConversationMessages = (
  conversationId: string | null,
  userId: string | undefined
) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Carregar histórico
  useEffect(() => {
    if (!conversationId || !userId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        setMessages((data as ChatMessage[]) ?? []);
        setLoading(false);
        // Marcar como lidas
        supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
      });
  }, [conversationId, userId]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Se eu sou destinatário, marca como lida
          if (msg.sender_id !== userId) {
            supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !userId || !content.trim()) return;
      setSending(true);
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
      });
      setSending(false);
      return { error };
    },
    [conversationId, userId]
  );

  return { messages, loading, sending, sendMessage };
};

/**
 * Inicia (ou recupera) uma conversa com outro usuário e retorna o ID.
 */
export const startConversationWith = async (otherUserId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    _other_user_id: otherUserId,
  });
  if (error) {
    console.error("Erro ao iniciar conversa:", error);
    return null;
  }
  return data as string;
};
