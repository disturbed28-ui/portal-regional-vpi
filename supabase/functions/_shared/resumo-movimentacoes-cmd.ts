import { lerMovimentacoesCMD, normalizarDivisaoCMD } from './movimentacoes-cmd.ts';

export async function movimentosMensaisRegionalCMD(db: any, regionalId: string, ano: number, mes: number) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3));
  const fim = new Date(Date.UTC(ano, mes, 1, 3) - 1);
  const { data: divisoes, error } = await db.from('divisoes').select('id, nome').eq('regional_id', regionalId);
  if (error) throw error;
  const relatorios: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('relatorios_semanais_divisao')
      .select('divisao_relatorio_id, divisao_relatorio_texto, entradas_json, saidas_json, updated_at')
      .eq('regional_relatorio_id', regionalId).eq('ano_referencia', ano).eq('mes_referencia', mes)
      .order('updated_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (error) throw error;
    relatorios.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return Promise.all((divisoes || []).map(async (div: any) => {
    const movimentos = await lerMovimentacoesCMD(db, { divisao: div.nome, dataInicio: inicio, dataFim: fim, incluirAfastamentos: true });
    const registros = relatorios.filter(r => r.divisao_relatorio_id === div.id || normalizarDivisaoCMD(r.divisao_relatorio_texto) === normalizarDivisaoCMD(div.nome));
    const entradasDetectadas = movimentos.entradas.map(m => ({ integrante_id: m.integrante_id, nome_colete: m.nome_colete, data_entrada: m.data_movimentacao.split('T')[0], motivo_entrada: m.detalhes === 'Novo integrante' ? 'Novo' : ['REATIVACAO', 'RETORNO_AFASTAMENTO'].includes(m.tipo) ? 'Retorno' : 'Transferido', _chave_dedup: m.id, tipo_movimentacao: m.tipo }));
    const saidasDetectadas = movimentos.saidas.map(m => ({ integrante_id: m.integrante_id, nome_colete: m.nome_colete, data_saida: m.data_movimentacao.split('T')[0], motivo_codigo: m.tipo, justificativa: m.detalhes, _chave_dedup: m.id }));
    return { divisao_id: div.id, divisao_nome: div.nome,
      entradas: unirMovimentosMensaisCMD(registros.flatMap(r => r.entradas_json || []), entradasDetectadas, 'data_entrada'),
      saidas: unirMovimentosMensaisCMD(registros.flatMap(r => r.saidas_json || []), saidasDetectadas, 'data_saida') };
  }));
}

export function unirMovimentosMensaisCMD(manuais: any[], detectados: any[], campoData: 'data_entrada' | 'data_saida') {
  const itens: any[] = [];
  for (const item of [...manuais, ...detectados]) {
    const nome = normalizarDivisaoCMD(item.nome_colete);
    const duplicado = itens.some(atual => {
      if (item._chave_dedup && item._chave_dedup === atual._chave_dedup) return true;
      const mesmaPessoa = item.integrante_id && atual.integrante_id ? item.integrante_id === atual.integrante_id : nome === normalizarDivisaoCMD(atual.nome_colete);
      if (!mesmaPessoa) return false;
      // A manual new-member entry may have a corrected date and no ID.
      if (campoData === 'data_entrada' && item.motivo_entrada === 'Novo' && atual.motivo_entrada === 'Novo') return true;
      return item[campoData] === atual[campoData];
    });
    if (!duplicado) itens.push(item);
  }
  return itens;
}