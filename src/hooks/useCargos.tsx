import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Cargo {
  id: string;
  grau: string;
  nome: string;
  nivel: number | null;
  created_at: string;
}

export const useCargos = () => {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCargos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .order('nivel', { ascending: false });

      if (error) {
        console.error('Error fetching cargos:', error);
      } else {
        setCargos(data || []);
      }
      setLoading(false);
    };

    fetchCargos();
  }, []);

  return { cargos, loading };
};
