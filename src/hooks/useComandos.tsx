import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Comando {
  id: string;
  nome: string;
  created_at: string;
}

export const useComandos = () => {
  const [comandos, setComandos] = useState<Comando[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComandos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('comandos')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error fetching comandos:', error);
      } else {
        setComandos(data || []);
      }
      setLoading(false);
    };

    fetchComandos();
  }, []);

  return { comandos, loading };
};
