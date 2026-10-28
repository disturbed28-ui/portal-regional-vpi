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
      entradas: unirMovimentosMensaisCMD(filtrarMovimentosMesCMD(registros.flatMap(r => r.entradas_json || []), 'data_entrada', ano, mes), entradasDetectadas, 'data_entrada'),
      saidas: unirMovimentosMensaisCMD(filtrarMovimentosMesCMD(registros.flatMap(r => r.saidas_json || []), 'data_saida', ano, mes), saidasDetectadas, 'data_saida') };
  }));
}

export function filtrarMovimentosMesCMD<T extends Record<string, any>>(itens: T[], campo: 'data_entrada' | 'data_saida', ano: number, mes: number): T[] {
  return itens.filter(item => {
    // Undated legacy/manual items remain attached to the saved report month.
    if (!item[campo]) return true;
    const data = new Date(item[campo]);
    if (!Number.isFinite(data.getTime())) return false;
    if (String(item[campo]).length === 10) return data.getUTCFullYear() === ano && data.getUTCMonth() + 1 === mes;
    const local = new Date(data.getTime() - 3 * 3600000);
    return local.getUTCFullYear() === ano && local.getUTCMonth() + 1 === mes;
  });
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
  const todasEntradas = divisoes.flatMap(d => d.entradas);
  const todasSaidas = divisoes.flatMap(d => d.saidas);
  const afastamento = (m: any) => m.afastamento === true || /AFAST|SUSPENS/.test(normalizarDivisaoCMD(`${m.tipo_movimentacao || ''} ${m.motivo_codigo || ''} ${m.motivo_entrada || ''} ${m.motivo_inativacao || ''}`));
  const transferido = (m: any) => /TRANSF/.test(normalizarDivisaoCMD(`${m.motivo_codigo || ''} ${m.motivo_entrada || ''}`)) || ['SAIDA', 'ENTRADA'].includes(m.tipo_movimentacao) && !!m.origem_divisao && !!m.destino_divisao;
  const interna = (m: any) => {
    if (m.transferencia_interna) return true;
    // Legacy manual records may not have the flag: both regional division sides
    // of the same transfer still cancel without counting as regional admissions/losses.
    if (!transferido(m)) return false;
    return todasEntradas.some(e => transferido(e) && mesmaTransferenciaCMD(m, e)) && todasSaidas.some(s => transferido(s) && mesmaTransferenciaCMD(m, s));
  };
  const entradas = todasEntradas.filter(m => !interna(m) && !afastamento(m));
  const saidas = todasSaidas.filter(m => !interna(m) && !afastamento(m));
  return { entradas: entradas.length, saidas: saidas.length, saldo: entradas.length - saidas.length };
}

function mesmaTransferenciaCMD(a: any, b: any) {
  const mesmaPessoa = a.integrante_id && b.integrante_id ? a.integrante_id === b.integrante_id : !!a.nome_colete && normalizarDivisaoCMD(a.nome_colete) === normalizarDivisaoCMD(b.nome_colete);
  if (!mesmaPessoa) return false;
  const dataA = a.data_entrada || a.data_saida;
  const dataB = b.data_entrada || b.data_saida;
  if (!dataA || dataA !== dataB) return false;
  for (const campo of ['origem_divisao', 'destino_divisao']) {
    if (a[campo] && b[campo] && normalizarDivisaoCMD(a[campo]) !== normalizarDivisaoCMD(b[campo])) return false;
  }
  return true;
}