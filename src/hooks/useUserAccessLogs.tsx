import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserAccessLog {
  id: string;
  created_at: string;
  user_id: string;
  tipo_evento: string;
  rota: string | null;
  origem: string;
  user_agent: string | null;
  extras: any;
}

const PAGE_SIZE = 20;

export const useUserAccessLogs = (userId: string | null) => {
  const [logs, setLogs] = useState<UserAccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchLogs = useCallback(async (pageNum: number, reset = false) => {
    if (!userId) return;

    setLoading(true);
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("user_access_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (reset) {
        setLogs(data || []);
      } else {
        setLogs((prev) => [...prev, ...(data || [])]);
      }

      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error("[useUserAccessLogs] Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setPage(0);
      fetchLogs(0, true);
    } else {
      setLogs([]);
      setHasMore(true);
    }
  }, [userId, fetchLogs]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLogs(nextPage);
    }
  }, [loading, hasMore, page, fetchLogs]);

  const refresh = useCallback(() => {
    setPage(0);
    fetchLogs(0, true);
  }, [fetchLogs]);

  return { logs, loading, hasMore, loadMore, refresh };
};
