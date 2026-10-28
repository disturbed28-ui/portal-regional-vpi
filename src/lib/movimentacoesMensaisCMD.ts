import { fromZonedTime } from 'date-fns-tz';

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
  const chave = (item: T) => {
    const nome = (item.nome_colete || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return `${item.integrante_id || nome}|${item.data_entrada || item.data_saida || ''}`;
  };
  const vistos = new Set(existentes.map(chave));
  const ids = new Set(existentes.map(item => item._chave_dedup).filter(Boolean));
  const novos = detectados.filter(item => {
    const identificador = chave(item);
    if ((item._chave_dedup && ids.has(item._chave_dedup)) || vistos.has(identificador)) return false;
    vistos.add(identificador);
    if (item._chave_dedup) ids.add(item._chave_dedup);
    return true;
  });
  return novos.length ? [...existentes, ...novos] : existentes;
}