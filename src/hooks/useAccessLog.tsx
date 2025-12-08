import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEBOUNCE_MS = 2000;

export const useAccessLog = () => {
  const lastLogRef = useRef<{ rota: string; timestamp: number } | null>(null);

  const logLogin = useCallback(async (userId: string, rota: string) => {
    if (!userId) return;

    try {
      // Update last_access_at in profiles
      await supabase
        .from("profiles")
        .update({ last_access_at: new Date().toISOString() })
        .eq("id", userId);

      // Insert login log
      await supabase.from("user_access_logs").insert({
        user_id: userId,
        tipo_evento: "login",
        rota: rota || "/",
        origem: "frontend",
        user_agent: navigator.userAgent,
      });

      console.log("[useAccessLog] Login logged for user:", userId);
    } catch (error) {
      console.error("[useAccessLog] Error logging login:", error);
    }
  }, []);

  const logPageView = useCallback(async (userId: string, rota: string) => {
    if (!userId || !rota) return;

    // Skip asset routes and api routes
    if (
      rota.startsWith("/api") ||
      rota.includes(".") ||
      rota.startsWith("/_")
    ) {
      return;
    }

    const now = Date.now();
    const last = lastLogRef.current;

    // Debounce: don't log same route within DEBOUNCE_MS
    if (last && last.rota === rota && now - last.timestamp < DEBOUNCE_MS) {
      return;
    }

    lastLogRef.current = { rota, timestamp: now };

    try {
      await supabase.from("user_access_logs").insert({
        user_id: userId,
        tipo_evento: "page_view",
        rota,
        origem: "frontend",
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("[useAccessLog] Error logging page view:", error);
    }
  }, []);

  return { logLogin, logPageView };
};
