import { normalizarDivisao, normalizarRegional } from './normalizeText';

export interface MovimentoHistorico {
  id: string;
  registro_id: number;
  nome_colete: string;
  tipo_movimentacao: string;
  data_movimentacao: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  divisao_atual?: string | null;
  detalhes?: string | null;
  origem: 'carga' | 'delta';
  divisao_origem?: string | null;
  divisao_destino?: string | null;
  regional_origem?: string | null;
  regional_destino?: string | null;
  divisao_origem_id?: string | null;
  divisao_destino_id?: string | null;
}

export async function lerPaginasHistorico<T>(consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const itens: T[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await consulta(inicio, inicio + 999);
    if (error) throw error;
    itens.push(...(data || []));
    if (!data || data.length < 1000) return itens;
  }
}

export function filtrarEscopoHistorico(movimentos: MovimentoHistorico[], escopo: { divisao?: string; regional?: string }, divisoes: { id: string; nome: string; regional: string }[]) {
  if (escopo.divisao) {
    const nome = normalizarDivisao(escopo.divisao);
    return movimentos.filter(m => [m.divisao_origem, m.divisao_destino, m.divisao_atual].some(d => normalizarDivisao(d || '') === nome));
  }
  if (escopo.regional) {
    const regional = normalizarRegional(escopo.regional);
    const autorizadas = divisoes.filter(d => normalizarRegional(d.regional) === regional);
    const ids = new Set(autorizadas.map(d => d.id));
    const nomes = new Set(autorizadas.map(d => normalizarDivisao(d.nome)));
    return movimentos.filter(m =>
      [m.regional_origem, m.regional_destino].some(r => normalizarRegional(r || '') === regional) ||
      [m.divisao_origem_id, m.divisao_destino_id].some(id => id && ids.has(id)) ||
      [m.divisao_origem, m.divisao_destino, m.divisao_atual].some(d => d && nomes.has(normalizarDivisao(d)))
    );
  }
  return movimentos;
}

function familia(tipo: string) {
  if (['AFASTAMENTO_NOVO', 'SAIDA_AFASTAMENTO'].includes(tipo)) return 'afastamento';
  if (['AFASTAMENTO_RETORNO', 'ENTRADA_RETORNO_AFASTAMENTO'].includes(tipo)) return 'retorno_afastamento';
  if (['INATIVACAO', 'SAIDA_DESLIGAMENTO', 'SAIDA_EXPULSAO', 'AFASTAMENTO_SAIDA'].includes(tipo)) return 'inativacao';
  return tipo;
}

export function deduplicarHistorico(movimentos: MovimentoHistorico[]) {
  const resultado: MovimentoHistorico[] = [];
  const vistos = new Map<string, number>();
  for (const m of movimentos) {
    // Transfers retain source/destination; two different transfers on the same day are distinct.
    const transfer = ['MUDANCA_DIVISAO', 'MUDANCA_REGIONAL', 'ENTRADA_TRANSFERENCIA', 'SAIDA_TRANSFERENCIA'].includes(m.tipo_movimentacao);
    const local = transfer ? `${normalizarDivisao(m.valor_anterior || m.divisao_origem || '')}|${normalizarDivisao(m.valor_novo || m.divisao_destino || '')}` : '';
    const dia = new Date(m.data_movimentacao).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const chave = `${m.registro_id || m.nome_colete}|${familia(m.tipo_movimentacao)}|${dia}|${local}`;
    const index = vistos.get(chave);
    if (index === undefined) {
      vistos.set(chave, resultado.length);
      resultado.push(m);
    } else if (resultado[index].tipo_movimentacao === 'INATIVACAO' && m.tipo_movimentacao !== 'INATIVACAO') {
      resultado[index] = m;
    }
  }
  return resultado.sort((a, b) => Date.parse(b.data_movimentacao) - Date.parse(a.data_movimentacao));
}

export const retornoRegistradoHistorico = (motivo: string | null, data: string | null) => Boolean(data && ['retornou', 'retorno_detectado_carga'].includes(motivo || ''));