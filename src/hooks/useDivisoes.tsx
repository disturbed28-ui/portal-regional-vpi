import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Divisao {
  id: string;
  regional_id: string;
  nome: string;
  created_at: string;
}

export const useDivisoes = (regionalId?: string) => {
  const [divisoes, setDivisoes] = useState<Divisao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDivisoes = async () => {
      setLoading(true);
      let query = supabase.from('divisoes').select('*');
      
      if (regionalId) {
        query = query.eq('regional_id', regionalId);
      }
      
      const { data, error } = await query.order('nome');

      if (error) {
        console.error('Error fetching divisoes:', error);
      } else {
        setDivisoes(data || []);
      }
      setLoading(false);
    };

    fetchDivisoes();
  }, [regionalId]);

  return { divisoes, loading };
};
