import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarDivisao, normalizarRegional } from "@/lib/normalizeText";
import type { Json } from "@/integrations/supabase/types";

// Tipos expandidos de movimentação baseados nas ações de resolução de delta
export type TipoMovimentacaoExpandida =
  | 'MUDANCA_DIVISAO'
  | 'MUDANCA_REGIONAL'
  | 'INATIVACAO'
  | 'REATIVACAO'
  | 'ENTRADA_NOVO'
  | 'ENTRADA_TRANSFERENCIA'
  | 'ENTRADA_RETORNO_AFASTAMENTO'
  | 'SAIDA_TRANSFERENCIA'
  | 'SAIDA_DESLIGAMENTO'
  | 'SAIDA_EXPULSAO'
  | 'SAIDA_AFASTAMENTO'
  | 'AFASTAMENTO_NOVO'
  | 'AFASTAMENTO_RETORNO'
  | 'AFASTAMENTO_SAIDA'
  | 'OUTRO';

export interface MovimentacaoDelta {
  id: string;
  nome_colete: string;
  registro_id: number;
  divisao_texto: string;
  tipo_movimentacao: TipoMovimentacaoExpandida;
  data_movimentacao: string;
  detalhes: string | null;
  cargo_grau_texto?: string | null;
  tipo_delta_original: string;
  acao_resolucao?: string | null;
}

interface UseMovimentacoesDeltasOptions {
  integrantesDaDivisao?: string;
  integrantesDaRegional?: string;
  tipos?: string[];
}

// Mapeamento tipo_delta + acao_resolucao -> tipo_movimentacao
function mapearTipoMovimentacao(
  tipoDelta: string,
  acao: string | null,
  observacao: string | null
): TipoMovimentacaoExpandida {
  // Para deltas antigos sem ação, inferir da observação
  if (!acao && observacao) {
    const obs = observacao.toLowerCase();
    
    if (tipoDelta === 'NOVO_ATIVOS') {
      if (obs.includes('veio') || obs.includes('transferido') || obs.includes('transferência')) {
        return 'ENTRADA_TRANSFERENCIA';
      }
      if (obs.includes('afastado') || obs.includes('retorno') || obs.includes('suspenso') || obs.includes('voltou')) {
        return 'ENTRADA_RETORNO_AFASTAMENTO';
      }
      return 'ENTRADA_NOVO';
    }
    
    if (tipoDelta === 'SUMIU_ATIVOS') {
      if (obs.includes('transferido') || obs.includes('transferência') || obs.includes('foi para')) {
        return 'SAIDA_TRANSFERENCIA';
      }
      if (obs.includes('expuls')) {
        return 'SAIDA_EXPULSAO';
      }
      if (obs.includes('afastado') || obs.includes('afastamento')) {
        return 'SAIDA_AFASTAMENTO';
      }
      if (obs.includes('deslig') || obs.includes('optou') || obs.includes('saiu') || obs.includes('pediu')) {
        return 'SAIDA_DESLIGAMENTO';
      }
      // Default para SUMIU_ATIVOS sem indicação clara
      return 'SAIDA_DESLIGAMENTO';
    }
    
    if (tipoDelta === 'NOVO_AFASTADOS') {
      return 'AFASTAMENTO_NOVO';
    }
    
    if (tipoDelta === 'SUMIU_AFASTADOS') {
      if (obs.includes('retorn') || obs.includes('voltou') || obs.includes('ativo')) {
        return 'AFASTAMENTO_RETORNO';
      }
      if (obs.includes('deslig') || obs.includes('saiu') || obs.includes('expuls')) {
        return 'AFASTAMENTO_SAIDA';
      }
      return 'AFASTAMENTO_RETORNO'; // Default
    }
  }
  
  // Mapeamento direto por ação configurada
  const mapa: Record<string, Record<string, TipoMovimentacaoExpandida>> = {
    'NOVO_ATIVOS': {
      'confirmar_novo': 'ENTRADA_NOVO',
      'confirmar_novo_transferido': 'ENTRADA_TRANSFERENCIA',
      'retorno_afastamento': 'ENTRADA_RETORNO_AFASTAMENTO',
      'novo_integrante': 'ENTRADA_NOVO',
      'veio_outra_regional': 'ENTRADA_TRANSFERENCIA',
      'veio_outro_comando': 'ENTRADA_TRANSFERENCIA',
    },
    'SUMIU_ATIVOS': {
      'transferido': 'SAIDA_TRANSFERENCIA',
      'transferido_outra_regional': 'SAIDA_TRANSFERENCIA',
      'transferido_outro_comando': 'SAIDA_TRANSFERENCIA',
      'desligamento': 'SAIDA_DESLIGAMENTO',
      'pediu_desligamento': 'SAIDA_DESLIGAMENTO',
      'expulso': 'SAIDA_EXPULSAO',
      'expulsao': 'SAIDA_EXPULSAO',
      'afastado': 'SAIDA_AFASTAMENTO',
      'afastamento': 'SAIDA_AFASTAMENTO',
      'entrou_afastamento': 'SAIDA_AFASTAMENTO',
    },
    'NOVO_AFASTADOS': {
      'confirmar': 'AFASTAMENTO_NOVO',
      'confirmar_afastamento': 'AFASTAMENTO_NOVO',
      'novo_afastamento': 'AFASTAMENTO_NOVO',
    },
    'SUMIU_AFASTADOS': {
      'retornou': 'AFASTAMENTO_RETORNO',
      'retorno_ativo': 'AFASTAMENTO_RETORNO',
      'voltou_ativo': 'AFASTAMENTO_RETORNO',
      'saiu': 'AFASTAMENTO_SAIDA',
      'desligamento': 'AFASTAMENTO_SAIDA',
      'expulso': 'AFASTAMENTO_SAIDA',
    },
  };
  
  return mapa[tipoDelta]?.[acao || ''] || 'OUTRO';
}

// Hook para buscar movimentações baseadas em deltas resolvidos
export const useMovimentacoesDeltas = (options?: UseMovimentacoesDeltasOptions) => {
  return useQuery({
    queryKey: ['movimentacoes-deltas', options?.integrantesDaDivisao, options?.integrantesDaRegional, options?.tipos],
    queryFn: async (): Promise<MovimentacaoDelta[]> => {
      // Buscar deltas resolvidos
      const { data: deltas, error } = await supabase
        .from('vw_deltas_resolvidos')
        .select('*')
        .order('resolvido_em', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar deltas resolvidos:', error);
        throw error;
      }

      // Buscar lista de divisões da regional (para filtro por regional)
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

      // Mapear deltas para movimentações
      let movimentacoes: MovimentacaoDelta[] = (deltas || [])
        .filter(delta => delta.tipo_delta && delta.resolvido_em) // Apenas resolvidos
        .map(delta => {
          const dadosAdicionais = delta.dados_adicionais as { acao_resolucao?: string } | null;
          const acao = dadosAdicionais?.acao_resolucao || null;
          
          return {
            id: delta.id || '',
            nome_colete: delta.nome_colete || '',
            registro_id: delta.registro_id || 0,
            divisao_texto: delta.divisao_texto || '',
            tipo_movimentacao: mapearTipoMovimentacao(
              delta.tipo_delta || '',
              acao,
              delta.observacao_admin
            ),
            data_movimentacao: delta.resolvido_em || '',
            detalhes: delta.observacao_admin,
            tipo_delta_original: delta.tipo_delta || '',
            acao_resolucao: acao,
          };
        });

      // Aplicar filtro por divisão
      if (options?.integrantesDaDivisao) {
        const divisaoNorm = normalizarDivisao(options.integrantesDaDivisao);
        movimentacoes = movimentacoes.filter(m => {
          const divNorm = normalizarDivisao(m.divisao_texto);
          return divNorm === divisaoNorm;
        });
      }

      // Aplicar filtro por regional
      if (options?.integrantesDaRegional && divisoesDaRegional.length > 0) {
        movimentacoes = movimentacoes.filter(m => {
          const divNorm = normalizarDivisao(m.divisao_texto);
          return divisoesDaRegional.includes(divNorm);
        });
      }

      // Filtrar por tipos se especificado
      if (options?.tipos && options.tipos.length > 0) {
        movimentacoes = movimentacoes.filter(m => options.tipos!.includes(m.tipo_movimentacao));
      }

      return movimentacoes;
    },
    enabled: true
  });
};