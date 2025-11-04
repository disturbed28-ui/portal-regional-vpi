import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MensalidadeDetalhes {
  total_parcelas: number;
  valor_total: number;
  parcelas: Array<{
    ref: string;
    data_vencimento: string;
    valor: number;
    dias_atraso: number;
  }>;
  primeira_divida: string;
  ultima_divida: string;
}

interface AfastamentoDetalhes {
  tipo_afastamento: string;
  data_afastamento: string;
  data_retorno_prevista: string;
  dias_afastado: number;
  dias_atraso: number;
  observacoes: string | null;
  cargo_grau_texto: string | null;
}

interface Pendencia {
  nome_colete: string;
  divisao_texto: string;
  tipo: 'mensalidade' | 'afastamento';
  detalhe: string;
  data_ref: string;
  registro_id: number;
  detalhes_completos: MensalidadeDetalhes | AfastamentoDetalhes;
}

export type { Pendencia, MensalidadeDetalhes, AfastamentoDetalhes };

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
      try {
        const parsedData = JSON.parse(cached);
        
        // Validação: Verificar se tem estrutura correta
        const isValidStructure = Array.isArray(parsedData) && 
          (parsedData.length === 0 || parsedData[0]?.detalhes_completos !== undefined);
        
        if (isValidStructure) {
          setPendencias(parsedData);
          setLoading(false);
          return;
        } else {
          // Cache antigo/inválido: remover e buscar novamente
          console.log('Cache inválido detectado, buscando dados atualizados...');
          localStorage.removeItem(cacheKey);
        }
      } catch (error) {
        console.error('Erro ao processar cache:', error);
        localStorage.removeItem(cacheKey);
      }
    }

    const fetchPendencias = async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const todasPendencias: Pendencia[] = [];

      // 1. Mensalidades atrasadas
      let queryMensalidades = supabase
        .from('mensalidades_atraso')
        .select('registro_id, nome_colete, divisao_texto, data_vencimento, ref, valor')
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

      // Agrupar por integrante e coletar TODAS as parcelas
      const mensalidadesMap = new Map();
      mensalidades?.forEach(m => {
        const key = `${m.registro_id}_${m.nome_colete}_${m.divisao_texto}`;
        
        if (!mensalidadesMap.has(key)) {
          mensalidadesMap.set(key, {
            registro_id: m.registro_id,
            nome_colete: m.nome_colete,
            divisao_texto: m.divisao_texto,
            parcelas: [],
            total_valor: 0,
            mais_antiga: m.data_vencimento,
            mais_recente: m.data_vencimento
          });
        }
        
        const entry = mensalidadesMap.get(key);
        const vencimento = new Date(m.data_vencimento);
        const diasAtraso = Math.floor((new Date().getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
        
        entry.parcelas.push({
          ref: m.ref,
          data_vencimento: m.data_vencimento,
          valor: m.valor || 0,
          dias_atraso: diasAtraso
        });
        
        entry.total_valor += (m.valor || 0);
        
        if (m.data_vencimento < entry.mais_antiga) {
          entry.mais_antiga = m.data_vencimento;
        }
        if (m.data_vencimento > entry.mais_recente) {
          entry.mais_recente = m.data_vencimento;
        }
      });

      // Ordenar parcelas e criar pendências
      mensalidadesMap.forEach((entry) => {
        entry.parcelas.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
        
        todasPendencias.push({
          registro_id: entry.registro_id,
          nome_colete: entry.nome_colete,
          divisao_texto: entry.divisao_texto,
          tipo: 'mensalidade',
          detalhe: `${entry.parcelas.length} parcela(s) atrasada(s)`,
          data_ref: entry.mais_antiga,
          detalhes_completos: {
            total_parcelas: entry.parcelas.length,
            valor_total: entry.total_valor,
            parcelas: entry.parcelas,
            primeira_divida: entry.mais_antiga,
            ultima_divida: entry.mais_recente
          }
        });
      });

      // 2. Afastamentos com retorno atrasado
      let queryAfastados = supabase
        .from('integrantes_afastados')
        .select(`
          registro_id,
          nome_colete,
          divisao_texto,
          data_retorno_prevista,
          data_afastamento,
          tipo_afastamento,
          observacoes,
          cargo_grau_texto
        `)
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
        const hoje = new Date();
        const retornoPrevisto = new Date(a.data_retorno_prevista);
        const dataAfastamento = new Date(a.data_afastamento);
        
        const diasAtraso = Math.floor(
          (hoje.getTime() - retornoPrevisto.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const diasAfastado = Math.floor(
          (hoje.getTime() - dataAfastamento.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        todasPendencias.push({
          registro_id: a.registro_id,
          nome_colete: a.nome_colete,
          divisao_texto: a.divisao_texto,
          tipo: 'afastamento',
          detalhe: `${diasAtraso} dia(s) de atraso no retorno`,
          data_ref: a.data_retorno_prevista,
          detalhes_completos: {
            tipo_afastamento: a.tipo_afastamento,
            data_afastamento: a.data_afastamento,
            data_retorno_prevista: a.data_retorno_prevista,
            dias_afastado: diasAfastado,
            dias_atraso: diasAtraso,
            observacoes: a.observacoes,
            cargo_grau_texto: a.cargo_grau_texto
          }
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
