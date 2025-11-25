import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SystemLog {
  id: string;
  created_at: string;
  user_id: string | null;
  tipo: string;
  origem: string;
  rota: string | null;
  mensagem: string | null;
  detalhes: any;
  notificacao_enviada: boolean;
}

export interface SystemLogsFilters {
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  origem?: string;
  userId?: string;
}

const LOGS_PER_PAGE = 20;

export const useSystemLogs = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<SystemLogsFilters>({});
  const { toast } = useToast();

  const [tiposDisponiveis, setTiposDisponiveis] = useState<string[]>([]);
  const [origensDisponiveis, setOrigensDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    fetchDistinctValues();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, filters]);

  const fetchDistinctValues = async () => {
    try {
      const { data: tipos } = await supabase
        .from('system_logs')
        .select('tipo')
        .order('tipo');
      
      const { data: origens } = await supabase
        .from('system_logs')
        .select('origem')
        .order('origem');

      if (tipos) {
        const uniqueTipos = [...new Set(tipos.map(t => t.tipo))];
        setTiposDisponiveis(uniqueTipos);
      }

      if (origens) {
        const uniqueOrigens = [...new Set(origens.map(o => o.origem))];
        setOrigensDisponiveis(uniqueOrigens);
      }
    } catch (error) {
      console.error('[useSystemLogs] Erro ao buscar valores distintos:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('system_logs')
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
      if (filters.origem) {
        query = query.eq('origem', filters.origem);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const from = (currentPage - 1) * LOGS_PER_PAGE;
      const to = from + LOGS_PER_PAGE - 1;

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('[useSystemLogs] Erro ao buscar logs:', error);
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
      console.error('[useSystemLogs] Exceção:', error);
      toast({
        title: "Erro inesperado",
        description: "Falha ao carregar logs de sistema",
        variant: "destructive",
      });
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (newFilters: SystemLogsFilters) => {
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
    origensDisponiveis,
    refetch: fetchLogs,
  };
};
