import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmailLog {
  id: string;
  created_at: string;
  tipo: string;
  to_email: string;
  to_nome: string | null;
  subject: string;
  body_preview: string | null;
  status: string;
  error_message: string | null;
  related_user_id: string | null;
  related_divisao_id: string | null;
  metadata: any;
  resend_message_id: string | null;
}

export interface EmailLogsFilters {
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  status?: string;
}

const LOGS_PER_PAGE = 20;

export const useEmailLogs = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<EmailLogsFilters>({});
  const { toast } = useToast();

  const [tiposDisponiveis, setTiposDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    fetchDistinctValues();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, filters]);

  const fetchDistinctValues = async () => {
    try {
      const { data: tipos } = await supabase
        .from('email_logs')
        .select('tipo')
        .order('tipo');

      if (tipos) {
        const uniqueTipos = [...new Set(tipos.map(t => t.tipo))];
        setTiposDisponiveis(uniqueTipos);
      }
    } catch (error) {
      console.error('[useEmailLogs] Erro ao buscar valores distintos:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' });

      if (filters.dataInicio) {
        query = query.gte('created_at', `${filters.dataInicio}T00:00:00`);
      }
      if (filters.dataFim) {
        query = query.lte('created_at', `${filters.dataFim}T23:59:59`);
      }
      if (filters.tipo) {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const from = (currentPage - 1) * LOGS_PER_PAGE;
      const to = from + LOGS_PER_PAGE - 1;

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('[useEmailLogs] Erro ao buscar logs:', error);
        toast({
          title: "Erro ao carregar logs",
          description: error.message,
          variant: "destructive",
        });
        setLogs([]);
        setTotalCount(0);
        return;
      }

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('[useEmailLogs] Exceção:', error);
      toast({
        title: "Erro inesperado",
        description: "Falha ao carregar logs de email",
        variant: "destructive",
      });
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (newFilters: EmailLogsFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

  return {
    logs,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    totalCount,
    filters,
    applyFilters,
    clearFilters,
    tiposDisponiveis,
    refetch: fetchLogs,
  };
};
