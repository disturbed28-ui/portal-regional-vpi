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
    const nomesRegionais = new Set((divisoes || []).map((d: any) => normalizarDivisaoCMD(d.nome)));
    const entradasDetectadas = movimentos.entradas.map(m => ({ integrante_id: m.integrante_id, nome_colete: m.nome_colete, data_entrada: m.data_movimentacao.split('T')[0], motivo_entrada: m.detalhes === 'Novo integrante' ? 'Novo' : ['REATIVACAO', 'RETORNO_AFASTAMENTO'].includes(m.tipo) ? 'Retorno' : 'Transferido', _chave_dedup: m.id, tipo_movimentacao: m.tipo, transferencia_interna: m.tipo === 'ENTRADA' && !!m.origem_divisao && nomesRegionais.has(normalizarDivisaoCMD(m.origem_divisao)), origem_divisao: m.origem_divisao, destino_divisao: m.destino_divisao }));
    const saidasDetectadas = movimentos.saidas.map(m => ({ integrante_id: m.integrante_id, nome_colete: m.nome_colete, data_saida: m.data_movimentacao.split('T')[0], motivo_codigo: m.tipo, justificativa: m.detalhes, _chave_dedup: m.id, transferencia_interna: m.tipo === 'SAIDA' && !!m.destino_divisao && nomesRegionais.has(normalizarDivisaoCMD(m.destino_divisao)), origem_divisao: m.origem_divisao, destino_divisao: m.destino_divisao }));
    return { divisao_id: div.id, divisao_nome: div.nome,
      entradas: unirMovimentosMensaisCMD(registros.flatMap(r => r.entradas_json || []), entradasDetectadas, 'data_entrada'),
      saidas: unirMovimentosMensaisCMD(registros.flatMap(r => r.saidas_json || []), saidasDetectadas, 'data_saida') };
  }));
}

export function unirMovimentosMensaisCMD(manuais: any[], detectados: any[], campoData: 'data_entrada' | 'data_saida') {
  const normalizarPessoa = (item: any) => normalizarDivisaoCMD(item.nome_colete);
  const tipo = (item: any) => {
    const texto = normalizarDivisaoCMD(`${item.motivo_entrada || ''} ${item.motivo_codigo || ''} ${item.tipo_movimentacao || ''}`);
    if (texto.includes('AFAST')) return 'afastamento';
    if (texto.includes('RETOR') || texto.includes('REATIV')) return 'retorno';
    if (texto.includes('TRANSF') || ['ENTRADA', 'SAIDA'].includes(item.motivo_codigo)) return 'transferencia';
    return campoData === 'data_saida' ? 'saida' : 'novo';
  };
  const itens: any[] = [];
  const manuaisEnriquecidos = manuais.map(item => {
    const candidatos = detectados.filter(d => (item.integrante_id && d.integrante_id ? item.integrante_id === d.integrante_id : normalizarPessoa(item) === normalizarPessoa(d)) && tipo(item) === tipo(d));
    const detectado = candidatos.find(d => d[campoData] === item[campoData]) || (candidatos.length === 1 ? candidatos[0] : undefined);
    return detectado ? { ...detectado, ...item, transferencia_interna: detectado.transferencia_interna } : item;
  });
  for (const item of [...manuaisEnriquecidos, ...detectados]) {
    const nome = normalizarPessoa(item);
    const duplicado = itens.some(atual => {
      if (item._chave_dedup && item._chave_dedup === atual._chave_dedup) return true;
      const mesmaPessoa = item.integrante_id && atual.integrante_id ? item.integrante_id === atual.integrante_id : nome === normalizarDivisaoCMD(atual.nome_colete);
      if (!mesmaPessoa) return false;
      if (tipo(item) !== tipo(atual)) return false;
      // A manual new-member entry may have a corrected date and no ID.
      if (campoData === 'data_entrada' && item.motivo_entrada === 'Novo' && atual.motivo_entrada === 'Novo') return true;
      return item[campoData] === atual[campoData];
    });
    if (!duplicado) itens.push(item);
  }
  return itens;
}

export function totaisEfetivosRegionalCMD(divisoes: { entradas: any[]; saidas: any[] }[]) {
  const entradas = divisoes.flatMap(d => d.entradas).filter(m => !m.transferencia_interna && m.tipo_movimentacao !== 'RETORNO_AFASTAMENTO' && !normalizarDivisaoCMD(m.motivo_entrada || '').includes('AFAST'));
  const saidas = divisoes.flatMap(d => d.saidas).filter(m => !m.transferencia_interna && m.motivo_codigo !== 'AFASTAMENTO' && !normalizarDivisaoCMD(m.motivo_codigo || '').includes('AFAST'));
  return { entradas: entradas.length, saidas: saidas.length, saldo: entradas.length - saidas.length };
}