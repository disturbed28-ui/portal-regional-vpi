import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UserPresence {
  user_id: string;
  nome_colete: string;
  online_at: string;
}

export const usePresence = (userId: string | undefined, nomeColete: string | null) => {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId || !nomeColete) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<UserPresence>();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: userId,
            nome_colete: nomeColete,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
    };
  }, [userId, nomeColete]);

  return { onlineUsers, totalOnline: onlineUsers.length };
};
