import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Regional {
  id: string;
  comando_id: string;
  nome: string;
  created_at: string;
}

export const useRegionais = () => {
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegionais = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('regionais')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error fetching regionais:', error);
      } else {
        setRegionais(data || []);
      }
      setLoading(false);
    };

    fetchRegionais();
  }, []);

  return { regionais, loading };
};
