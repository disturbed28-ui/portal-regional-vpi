import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { getNivelAcesso } from '@/lib/grauUtils';

interface Aniversariante {
  id: string;
  nome_colete: string;
  divisao_texto: string;
  regional_texto: string;
  data_nascimento: string;
  dia: number;
  mes: number;
}

interface UseAniversariantesOptions {
  mesFiltro: number | null; // 1-12 ou null para todos
}

export function useAniversariantes(userId: string | undefined, options: UseAniversariantesOptions) {
  const { profile, loading: profileLoading } = useProfile(userId);
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || profileLoading) return;

    const fetchAniversariantes = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('integrantes_portal')
          .select('id, nome_colete, divisao_texto, regional_texto, data_nascimento, divisao_id, regional_id')
          .eq('ativo', true)
          .not('data_nascimento', 'is', null);

        // Aplicar filtro de visibilidade baseado no grau
        const nivelAcesso = getNivelAcesso(profile?.grau);

        if (nivelAcesso === 'regional' && profile?.regional_id) {
          query = query.eq('regional_id', profile.regional_id);
        } else if (nivelAcesso === 'divisao' && profile?.divisao_id) {
          query = query.eq('divisao_id', profile.divisao_id);
        }
        // nivelAcesso === 'comando' não adiciona filtro (vê todos)

        const { data, error: queryError } = await query;

        if (queryError) {
          console.error('Erro ao buscar aniversariantes:', queryError);
          setError('Erro ao carregar aniversariantes');
          setAniversariantes([]);
          return;
        }

        // Processar dados
        const processed: Aniversariante[] = (data || [])
          .filter(item => item.data_nascimento)
          .map(item => {
            const date = new Date(item.data_nascimento + 'T00:00:00');
            return {
              id: item.id,
              nome_colete: item.nome_colete,
              divisao_texto: item.divisao_texto,
              regional_texto: item.regional_texto,
              data_nascimento: item.data_nascimento,
              dia: date.getDate(),
              mes: date.getMonth() + 1
            };
          });

        setAniversariantes(processed);
      } catch (err) {
        console.error('Erro inesperado:', err);
        setError('Erro inesperado ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchAniversariantes();
  }, [userId, profileLoading, profile?.grau, profile?.regional_id, profile?.divisao_id]);

  // Filtrar por mês e ordenar por dia
  const aniversariantesFiltrados = useMemo(() => {
    let filtered = aniversariantes;

    // Aplicar filtro de mês
    if (options.mesFiltro !== null) {
      filtered = filtered.filter(a => a.mes === options.mesFiltro);
    }

    // Ordenar por dia do mês
    return filtered.sort((a, b) => a.dia - b.dia);
  }, [aniversariantes, options.mesFiltro]);

  return {
    aniversariantes: aniversariantesFiltrados,
    loading: loading || profileLoading,
    error,
    totalCadastrados: aniversariantes.length
  };
}
