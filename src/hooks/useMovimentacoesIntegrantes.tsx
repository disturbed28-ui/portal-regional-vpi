import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarRegional, normalizarDivisao } from "@/lib/normalizeText";

export interface MovimentacaoIntegrante {
  id: string;
  integrante_id: string | null;
  registro_id: number;
  nome_colete: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  data_movimentacao: string;
  data_carga: string | null;
  carga_id: string | null;
  tipo_movimentacao: 'MUDANCA_DIVISAO' | 'MUDANCA_REGIONAL' | 'INATIVACAO' | 'REATIVACAO' | 'OUTRO';
  divisao_atual?: string | null;
  regional_atual?: string | null;
}

interface UseMovimentacoesOptions {
  divisao?: string;
  dataInicio?: Date;
  dataFim?: Date;
  tipos?: string[];
}

// Interface para o hook com filtro por envolvimento da divisão/regional
interface UseMovimentacoesComFiltroOptions {
  integrantesDaDivisao?: string;    // Busca movimentações onde esta divisão está envolvida (origem ou destino)
  integrantesDaRegional?: string;   // Busca movimentações onde esta regional está envolvida (origem ou destino)
  tipos?: string[];
}

// Helper para determinar tipo de movimentação
const getTipoMovimentacao = (campo: string, valorNovo: string | null): MovimentacaoIntegrante['tipo_movimentacao'] => {
  if (campo === 'divisao_texto') return 'MUDANCA_DIVISAO';
  if (campo === 'regional_texto') return 'MUDANCA_REGIONAL';
  if (campo === 'ativo' && valorNovo === 'false') return 'INATIVACAO';
  if (campo === 'ativo' && valorNovo === 'true') return 'REATIVACAO';
  return 'OUTRO';
};

// Helper para verificar se é uma mudança real (não apenas normalização de texto)
const isMudancaReal = (campo: string, valorAnterior: string | null, valorNovo: string | null): boolean => {
  // Campo ativo: só é válido se valor_novo for 'true' ou 'false' explícito
  if (campo === 'ativo') {
    return valorNovo === 'true' || valorNovo === 'false';
  }
  
  // Campo divisão: comparar normalizado para evitar falsos positivos de formatação
  if (campo === 'divisao_texto') {
    const anteriorNorm = normalizarDivisao(valorAnterior || '');
    const novoNorm = normalizarDivisao(valorNovo || '');
    return anteriorNorm !== novoNorm;
  }
  
  // Campo regional: comparar normalizado
  if (campo === 'regional_texto') {
    const anteriorNorm = normalizarRegional(valorAnterior || '');
    const novoNorm = normalizarRegional(valorNovo || '');
    return anteriorNorm !== novoNorm;
  }
  
  return true;
};

// Hook para buscar movimentações de integrantes
export const useMovimentacoesIntegrantes = (options?: UseMovimentacoesOptions) => {
  return useQuery({
    queryKey: ['movimentacoes-integrantes', options?.divisao, options?.dataInicio?.toISOString(), options?.dataFim?.toISOString(), options?.tipos],
    queryFn: async (): Promise<MovimentacaoIntegrante[]> => {
      let query = supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .in('campo_alterado', ['divisao_texto', 'regional_texto', 'ativo'])
        .order('created_at', { ascending: false });

      if (options?.dataInicio) {
        query = query.gte('created_at', options.dataInicio.toISOString());
      }
      if (options?.dataFim) {
        query = query.lte('created_at', options.dataFim.toISOString());
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
      }

      let movimentacoes: MovimentacaoIntegrante[] = (data || [])
        .filter(item => isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo))
        .map(item => ({
          id: item.id,
          integrante_id: item.integrante_id,
          registro_id: item.registro_id,
          nome_colete: item.nome_colete,
          campo_alterado: item.campo_alterado,
          valor_anterior: item.valor_anterior,
          valor_novo: item.valor_novo,
          data_movimentacao: item.created_at,
          data_carga: null,
          carga_id: item.carga_historico_id,
          tipo_movimentacao: getTipoMovimentacao(item.campo_alterado, item.valor_novo)
        }));

      if (options?.divisao) {
        return movimentacoes.filter(m => 
          m.valor_anterior === options.divisao || m.valor_novo === options.divisao
        );
      }

      if (options?.tipos && options.tipos.length > 0) {
        return movimentacoes.filter(m => options.tipos!.includes(m.tipo_movimentacao));
      }

      return movimentacoes;
    },
    enabled: true
  });
};

// Hook com filtro baseado em ENVOLVIMENTO da divisão/regional
// Mostra movimentações onde a divisão/regional aparece como ORIGEM ou DESTINO
export const useMovimentacoesComFiltro = (options?: UseMovimentacoesComFiltroOptions) => {
  return useQuery({
    queryKey: ['movimentacoes-com-filtro', options?.integrantesDaDivisao, options?.integrantesDaRegional, options?.tipos],
    queryFn: async (): Promise<MovimentacaoIntegrante[]> => {
      // 1. Buscar TODAS as movimentações relevantes
      const { data, error } = await supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .in('campo_alterado', ['divisao_texto', 'regional_texto', 'ativo'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
      }

      // 2. Buscar informações atuais dos integrantes para enriquecer os dados
      const { data: integrantes } = await supabase
        .from('integrantes_portal')
        .select('id, divisao_texto, regional_texto')
        .eq('ativo', true);
      
      const integrantesMap = new Map<string, { divisao: string; regional: string }>();
      (integrantes || []).forEach(i => {
        integrantesMap.set(i.id, { divisao: i.divisao_texto, regional: i.regional_texto });
      });

      // 3. Buscar lista de divisões da regional (para filtro por regional)
      let divisoesDaRegional: string[] = [];
      if (options?.integrantesDaRegional) {
        const { data: divisoes } = await supabase
          .from('divisoes')
          .select('nome, regional:regionais!inner(nome)')
          .eq('regional.nome', options.integrantesDaRegional);
        
        if (divisoes) {
          divisoesDaRegional = divisoes.map(d => normalizarDivisao(d.nome));
        }
        
        // Se não encontrou por nome exato, tentar buscar com normalização
        if (divisoesDaRegional.length === 0) {
          const { data: todasDivisoes } = await supabase
            .from('divisoes')
            .select('nome, regional:regionais(nome)');
          
          const regionalNorm = normalizarRegional(options.integrantesDaRegional);
          divisoesDaRegional = (todasDivisoes || [])
            .filter(d => {
              const regNome = (d.regional as any)?.nome;
              return regNome && normalizarRegional(regNome) === regionalNorm;
            })
            .map(d => normalizarDivisao(d.nome));
        }
      }

      // 4. Mapear e filtrar movimentações
      let movimentacoes: MovimentacaoIntegrante[] = (data || [])
        .filter(item => isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo))
        .map(item => {
          const infoAtual = item.integrante_id ? integrantesMap.get(item.integrante_id) : null;
          return {
            id: item.id,
            integrante_id: item.integrante_id,
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            campo_alterado: item.campo_alterado,
            valor_anterior: item.valor_anterior,
            valor_novo: item.valor_novo,
            data_movimentacao: item.created_at,
            data_carga: null,
            carga_id: item.carga_historico_id,
            tipo_movimentacao: getTipoMovimentacao(item.campo_alterado, item.valor_novo),
            divisao_atual: infoAtual?.divisao || null,
            regional_atual: infoAtual?.regional || null
          };
        });

      // 5. Aplicar filtro por ENVOLVIMENTO na divisão
      if (options?.integrantesDaDivisao) {
        const divisaoNorm = normalizarDivisao(options.integrantesDaDivisao);
        
        movimentacoes = movimentacoes.filter(m => {
          if (m.campo_alterado === 'divisao_texto') {
            // Mudança de divisão: incluir se a divisão está envolvida como origem OU destino
            const anteriorNorm = normalizarDivisao(m.valor_anterior || '');
            const novoNorm = normalizarDivisao(m.valor_novo || '');
            return anteriorNorm === divisaoNorm || novoNorm === divisaoNorm;
          }
          
          if (m.campo_alterado === 'regional_texto') {
            // Mudança de regional: não mostrar para filtro de divisão específica
            return false;
          }
          
          if (m.campo_alterado === 'ativo') {
            // Inativação/Reativação: incluir se o integrante é/era desta divisão
            const divisaoAtualNorm = m.divisao_atual ? normalizarDivisao(m.divisao_atual) : null;
            return divisaoAtualNorm === divisaoNorm;
          }
          
          return false;
        });
      }
      
      // 6. Aplicar filtro por ENVOLVIMENTO na regional
      else if (options?.integrantesDaRegional) {
        const regionalNorm = normalizarRegional(options.integrantesDaRegional);
        
        movimentacoes = movimentacoes.filter(m => {
          if (m.campo_alterado === 'divisao_texto') {
            // Mudança de divisão: incluir se alguma das divisões pertence à regional
            const anteriorNorm = normalizarDivisao(m.valor_anterior || '');
            const novoNorm = normalizarDivisao(m.valor_novo || '');
            
            const origemDaRegional = divisoesDaRegional.includes(anteriorNorm);
            const destinoDaRegional = divisoesDaRegional.includes(novoNorm);
            
            return origemDaRegional || destinoDaRegional;
          }
          
          if (m.campo_alterado === 'regional_texto') {
            // Mudança de regional: incluir se a regional está envolvida como origem OU destino
            const anteriorNorm = normalizarRegional(m.valor_anterior || '');
            const novoNorm = normalizarRegional(m.valor_novo || '');
            return anteriorNorm === regionalNorm || novoNorm === regionalNorm;
          }
          
          if (m.campo_alterado === 'ativo') {
            // Inativação/Reativação: incluir se o integrante é/era desta regional
            const regionalAtualNorm = m.regional_atual ? normalizarRegional(m.regional_atual) : null;
            if (regionalAtualNorm === regionalNorm) return true;
            
            // Também verificar se a divisão atual pertence à regional
            const divisaoAtualNorm = m.divisao_atual ? normalizarDivisao(m.divisao_atual) : null;
            return divisaoAtualNorm ? divisoesDaRegional.includes(divisaoAtualNorm) : false;
          }
          
          return false;
        });
      }

      // 7. Filtrar por tipos se especificado
      if (options?.tipos && options.tipos.length > 0) {
        movimentacoes = movimentacoes.filter(m => options.tipos!.includes(m.tipo_movimentacao));
      }

      return movimentacoes;
    },
    enabled: true
  });
};

// Hook específico para sugerir entradas/saídas da semana para uma divisão
export const useSugestoesEntradasSaidas = (divisao: string | null, dataInicio: Date | null, dataFim: Date | null) => {
  return useQuery({
    queryKey: ['sugestoes-entradas-saidas', divisao, dataInicio?.toISOString(), dataFim?.toISOString()],
    queryFn: async () => {
      if (!divisao || !dataInicio || !dataFim) {
        return { entradas: [], saidas: [] };
      }

      const { data, error } = await supabase
        .from('atualizacoes_carga')
        .select(`
          id,
          integrante_id,
          registro_id,
          nome_colete,
          campo_alterado,
          valor_anterior,
          valor_novo,
          created_at,
          carga_historico_id
        `)
        .eq('campo_alterado', 'divisao_texto')
        .gte('created_at', dataInicio.toISOString())
        .lte('created_at', dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar sugestões:', error);
        throw error;
      }

      const entradas: MovimentacaoIntegrante[] = [];
      const saidas: MovimentacaoIntegrante[] = [];

      (data || []).forEach(item => {
        if (!isMudancaReal(item.campo_alterado, item.valor_anterior, item.valor_novo)) {
          return;
        }

        const mov: MovimentacaoIntegrante = {
          id: item.id,
          integrante_id: item.integrante_id,
          registro_id: item.registro_id,
          nome_colete: item.nome_colete,
          campo_alterado: item.campo_alterado,
          valor_anterior: item.valor_anterior,
          valor_novo: item.valor_novo,
          data_movimentacao: item.created_at,
          data_carga: null,
          carga_id: item.carga_historico_id,
          tipo_movimentacao: 'MUDANCA_DIVISAO'
        };

        const divisaoNorm = normalizarDivisao(divisao);
        
        if (normalizarDivisao(item.valor_novo || '') === divisaoNorm) {
          entradas.push(mov);
        }
        if (normalizarDivisao(item.valor_anterior || '') === divisaoNorm) {
          saidas.push(mov);
        }
      });

      return { entradas, saidas };
    },
    enabled: !!divisao && !!dataInicio && !!dataFim
  });
};
