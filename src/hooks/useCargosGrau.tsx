import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Cargo {
  id: string;
  nome: string;
  grau: string;
  nivel: number | null;
}

export function useCargosGrau(grau: 'V' | 'VI' | null) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!grau) {
      setCargos([]);
      setLoading(false);
      return;
    }

    const fetchCargos = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('cargos')
        .select('id, nome, grau, nivel')
        .eq('grau', grau)
        .order('nivel', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar cargos:', error);
        setCargos([]);
      } else {
        setCargos(data || []);
      }
      
      setLoading(false);
    };

    fetchCargos();
  }, [grau]);

  return { cargos, loading };
}
