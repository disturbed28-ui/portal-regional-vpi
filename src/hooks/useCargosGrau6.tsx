import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CargoGrau6 {
  id: string;
  nome: string;
  grau: string;
  nivel: number | null;
}

export function useCargosGrau6() {
  const [cargos, setCargos] = useState<CargoGrau6[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCargosGrau6() {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('cargos')
        .select('id, nome, grau, nivel')
        .eq('grau', 'VI')
        .order('nivel', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar cargos Grau VI:', error);
        setCargos([]);
      } else {
        setCargos(data || []);
      }
      
      setLoading(false);
    }

    fetchCargosGrau6();
  }, []);

  return { cargos, loading };
}
