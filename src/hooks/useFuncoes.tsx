import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Funcao {
  id: string;
  nome: string;
  ordem: number | null;
  created_at: string;
}

export const useFuncoes = () => {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFuncoes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('funcoes')
        .select('*')
        .order('ordem');

      if (error) {
        console.error('Error fetching funcoes:', error);
      } else {
        setFuncoes(data || []);
      }
      setLoading(false);
    };

    fetchFuncoes();
  }, []);

  return { funcoes, loading };
};
