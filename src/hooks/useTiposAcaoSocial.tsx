import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TipoAcaoSocial {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number | null;
}

export const useTiposAcaoSocial = () => {
  const [tipos, setTipos] = useState<TipoAcaoSocial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTipos = async () => {
      const { data, error } = await supabase
        .from('acoes_sociais_tipos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true, nullsFirst: false });

      if (!error && data) {
        setTipos(data);
      }
      setLoading(false);
    };

    fetchTipos();
  }, []);

  return { tipos, loading };
};
