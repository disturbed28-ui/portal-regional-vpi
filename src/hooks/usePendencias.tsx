import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento';
  detalhe: string;
  data_ref: string;
}

export const usePendencias = (
  userId: string | undefined,
  userRole: 'admin' | 'regional' | 'diretor_divisao' | null,
  regionalId?: string,
  divisaoId?: string
) => {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !userRole) {
      setLoading(false);
      return;
    }

    // Verificar cache do dia
    const cacheKey = `pendencias_${userId}_${new Date().toISOString().split('T')[0]}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      setPendencias(JSON.parse(cached));
      setLoading(false);
      return;
    }

    const fetchPendencias = async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const todasPendencias: Pendencia[] = [];

      // 1. Mensalidades atrasadas
      let queryMensalidades = supabase
        .from('mensalidades_atraso')
        .select('nome_colete, divisao_texto, data_vencimento, ref')
        .eq('ativo', true)
        .eq('liquidado', false)
        .lt('data_vencimento', hoje);

      // Filtrar por escopo
      if (userRole === 'regional' && regionalId) {
        const { data: divisoes } = await supabase
          .from('divisoes')
          .select('nome')
          .eq('regional_id', regionalId);
        
        const nomeDivisoes = divisoes?.map(d => d.nome) || [];
        if (nomeDivisoes.length > 0) {
          queryMensalidades = queryMensalidades.in('divisao_texto', nomeDivisoes);
        }
      } else if (userRole === 'diretor_divisao' && divisaoId) {
        const { data: divisao } = await supabase
          .from('divisoes')
          .select('nome')
          .eq('id', divisaoId)
          .single();
        
        if (divisao) {
          queryMensalidades = queryMensalidades.eq('divisao_texto', divisao.nome);
        }
      }

      const { data: mensalidades } = await queryMensalidades;

      // Agrupar por integrante
      const mensalidadesMap = new Map();
      mensalidades?.forEach(m => {
        const key = `${m.nome_colete}_${m.divisao_texto}`;
        if (!mensalidadesMap.has(key)) {
          mensalidadesMap.set(key, {
            nome_colete: m.nome_colete,
            divisao_texto: m.divisao_texto,
            count: 0,
            mais_antiga: m.data_vencimento
          });
        }
        const entry = mensalidadesMap.get(key);
        entry.count++;
        if (m.data_vencimento < entry.mais_antiga) {
          entry.mais_antiga = m.data_vencimento;
        }
      });

      mensalidadesMap.forEach(m => {
        todasPendencias.push({
          nome_colete: m.nome_colete,
          divisao_texto: m.divisao_texto,
          tipo: 'mensalidade',
          detalhe: `${m.count} parcela(s) atrasada(s)`,
          data_ref: m.mais_antiga
        });
      });

      // 2. Afastamentos com retorno atrasado
      let queryAfastados = supabase
        .from('integrantes_afastados')
        .select('nome_colete, divisao_texto, data_retorno_prevista')
        .eq('ativo', true)
        .is('data_retorno_efetivo', null)
        .lt('data_retorno_prevista', hoje);

      // Aplicar mesmo filtro de escopo
      if (userRole === 'regional' && regionalId) {
        const { data: divisoes } = await supabase
          .from('divisoes')
          .select('nome')
          .eq('regional_id', regionalId);
        
        const nomeDivisoes = divisoes?.map(d => d.nome) || [];
        if (nomeDivisoes.length > 0) {
          queryAfastados = queryAfastados.in('divisao_texto', nomeDivisoes);
        }
      } else if (userRole === 'diretor_divisao' && divisaoId) {
        const { data: divisao } = await supabase
          .from('divisoes')
          .select('nome')
          .eq('id', divisaoId)
          .single();
        
        if (divisao) {
          queryAfastados = queryAfastados.eq('divisao_texto', divisao.nome);
        }
      }

      const { data: afastados } = await queryAfastados;

      afastados?.forEach(a => {
        const diasAtraso = Math.floor(
          (new Date().getTime() - new Date(a.data_retorno_prevista).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        
        todasPendencias.push({
          nome_colete: a.nome_colete,
          divisao_texto: a.divisao_texto,
          tipo: 'afastamento',
          detalhe: `${diasAtraso} dia(s) de atraso no retorno`,
          data_ref: a.data_retorno_prevista
        });
      });

      // Ordenar por data mais antiga
      todasPendencias.sort((a, b) => 
        a.data_ref.localeCompare(b.data_ref)
      );

      setPendencias(todasPendencias);
      localStorage.setItem(cacheKey, JSON.stringify(todasPendencias));
      setLoading(false);
    };

    fetchPendencias();
  }, [userId, userRole, regionalId, divisaoId]);

  return { pendencias, loading, totalPendencias: pendencias.length };
};
