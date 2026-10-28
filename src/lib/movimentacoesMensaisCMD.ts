import { fromZonedTime } from 'date-fns-tz';
import { unirMovimentosMensaisCMD } from '../../supabase/functions/_shared/resumo-movimentacoes-cmd';

export function retornoEfetivoCMD(motivo: string | null, data: string | null) {
  return Boolean(data && (motivo === 'retornou' || motivo === 'retorno_detectado_carga'));
}

export function periodoMensalCMD(referencia: { ano_referencia: number; mes_referencia: number }) {
  const { ano_referencia: ano, mes_referencia: mes } = referencia;
  const dataInicio = fromZonedTime(new Date(ano, mes - 1, 1, 0, 0, 0, 0), 'America/Sao_Paulo');
  const dataFim = new Date(fromZonedTime(new Date(ano, mes, 1, 0, 0, 0, 0), 'America/Sao_Paulo').getTime() - 1);
  return { dataInicio, dataFim };
}

type ItemMovimento = {
  integrante_id?: string | null;
  nome_colete?: string;
  data_entrada?: string;
  data_saida?: string;
  _chave_dedup?: string;
};

// Keep existing/manual edits; only append newly detected movements in each block.
export function incorporarMovimentosCMD<T extends ItemMovimento>(existentes: T[], detectados: T[]): T[] {
  const campo = [...existentes, ...detectados].some(i => i.data_saida) ? 'data_saida' : 'data_entrada';
  return unirMovimentosMensaisCMD(existentes, detectados, campo) as T[];
}