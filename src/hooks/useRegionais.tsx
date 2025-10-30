import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Regional {
  id: string;
  comando_id: string;
  nome: string;
  created_at: string;
}

export const useRegionais = (comandoId?: string) => {
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegionais = async () => {
      setLoading(true);
      let query = supabase.from('regionais').select('*');
      
      if (comandoId) {
        query = query.eq('comando_id', comandoId);
      }
      
      const { data, error } = await query.order('nome');

      if (error) {
        console.error('Error fetching regionais:', error);
      } else {
        setRegionais(data || []);
      }
      setLoading(false);
    };

    fetchRegionais();
  }, [comandoId]);

  return { regionais, loading };
};
