import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Interfaces
interface RelatorioSemanalDivisao {
  id: string;
  divisao_relatorio_texto: string;
  divisao_relatorio_id: string | null;
  entradas_json: any[];
  saidas_json: any[];
  inadimplencias_json: any[];
  conflitos_json: any[];
  acoes_sociais_json: any[];
  estatisticas_divisao_json: any;
}

interface DivisaoCompleta {
  divisao_id: string;
  divisao_nome: string;
  tem_relatorio: boolean;
  relatorio?: RelatorioSemanalDivisao;
}

interface DadosRelatorio {
  regional_nome: string;
  regional_numero_romano: string;
  ano: number;
  mes: number;
  semana: number;
  divisoes: DivisaoCompleta[];
  total_mes_anterior: number;
}

// Extrai número romano do nome da regional
function extrairNumeroRomano(nome: string): string {
  // Busca padrões como "I", "II", "III", "IV", "V" no nome
  const match = nome.match(/\b([IVX]+)\b/);
  return match ? match[1] : 'V'; // default V
}

// Ordena divisões: alfabético, mas "Regional*" sempre no final
function ordenarDivisoes(divisoes: DivisaoCompleta[]): DivisaoCompleta[] {
  return divisoes.sort((a, b) => {
    const aRegional = a.divisao_nome.toLowerCase().startsWith('regional');
    const bRegional = b.divisao_nome.toLowerCase().startsWith('regional');
    if (aRegional && !bRegional) return 1;  // a vai pro fim
    if (!aRegional && bRegional) return -1; // b vai pro fim
    return a.divisao_nome.localeCompare(b.divisao_nome);
  });
}

// Busca todos os dados necessários
async function fetchDadosRelatorio(
  regional_id: string,
  ano: number,
  mes: number,
  semana: number
): Promise<DadosRelatorio> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Fetch Dados] Buscando para:', { regional_id, ano, mes, semana });

  // 1. Buscar regional
  const { data: regional, error: regionalError } = await supabase
    .from('regionais')
    .select('nome')
    .eq('id', regional_id)
    .single();

  if (regionalError) throw new Error(`Erro ao buscar regional: ${regionalError.message}`);

  // 2. Buscar TODAS as divisões da regional
  const { data: divisoes, error: divisoesError } = await supabase
    .from('divisoes')
    .select('id, nome')
    .eq('regional_id', regional_id)
    .order('nome');

  if (divisoesError) throw new Error(`Erro ao buscar divisões: ${divisoesError.message}`);

  // 3. Buscar relatórios semanais das divisões
  const { data: relatorios, error: relatoriosError } = await supabase
    .from('relatorios_semanais_divisao')
    .select(`
      id,
      divisao_relatorio_texto,
      divisao_relatorio_id,
      entradas_json,
      saidas_json,
      inadimplencias_json,
      conflitos_json,
      acoes_sociais_json,
      estatisticas_divisao_json
    `)
    .eq('regional_relatorio_id', regional_id)
    .eq('ano_referencia', ano)
    .eq('mes_referencia', mes)
    .eq('semana_no_mes', semana);

  if (relatoriosError) throw new Error(`Erro ao buscar relatórios: ${relatoriosError.message}`);

  // 4. Buscar total do mês anterior (última semana do mês anterior)
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  
  const { data: relatoriosMesAnterior } = await supabase
    .from('relatorios_semanais_divisao')
    .select('estatisticas_divisao_json, semana_no_mes')
    .eq('regional_relatorio_id', regional_id)
    .eq('ano_referencia', anoAnterior)
    .eq('mes_referencia', mesAnterior)
    .order('semana_no_mes', { ascending: false })
    .limit(15); // Pegar última semana de cada divisão

  let totalMesAnterior = 0;
  if (relatoriosMesAnterior && relatoriosMesAnterior.length > 0) {
    // Agrupar por semana e pegar a última
    const ultimaSemana = Math.max(...relatoriosMesAnterior.map(r => r.semana_no_mes));
    const relatoriosUltimaSemana = relatoriosMesAnterior.filter(r => r.semana_no_mes === ultimaSemana);
    
    relatoriosUltimaSemana.forEach(rel => {
      const stats = rel.estatisticas_divisao_json || {};
      totalMesAnterior += (stats.total_tem_moto || 0) + (stats.total_tem_carro || 0) + (stats.total_sem_veiculo || 0);
    });
  }

  // 5. Fazer merge: todas divisões + relatórios
  const divisoesCompletas: DivisaoCompleta[] = (divisoes || []).map(div => {
    const relatorio = relatorios?.find(rel => 
      rel.divisao_relatorio_id === div.id || 
      rel.divisao_relatorio_texto.toLowerCase() === div.nome.toLowerCase()
    );
    
    return {
      divisao_id: div.id,
      divisao_nome: div.nome,
      tem_relatorio: !!relatorio,
      relatorio: relatorio
    };
  });

  console.log('[Fetch Dados] Total divisões:', divisoesCompletas.length);
  console.log('[Fetch Dados] Com relatório:', divisoesCompletas.filter(d => d.tem_relatorio).length);

  return {
    regional_nome: regional.nome,
    regional_numero_romano: extrairNumeroRomano(regional.nome),
    ano,
    mes,
    semana,
    divisoes: ordenarDivisoes(divisoesCompletas),
    total_mes_anterior: totalMesAnterior
  };
}

// ============================================================================
// BLOCOS DO RELATÓRIO
// ============================================================================

// Bloco 1: Cabeçalho Regional
function adicionarCabecalhoRegional(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = [`CMD REGIONAL ${dados.regional_numero_romano}`];
  wsData[row++] = [`REGIONAL ${dados.regional_nome.toUpperCase()}`];
  wsData[row++] = ['RELATÓRIO SEMANAL DE ATIVIDADES'];
  wsData[row++] = [];
  return row;
}

// Bloco 2: Período
function adicionarPeriodo(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['PERÍODO'];
  wsData[row++] = [`Ano: ${dados.ano} | Mês: ${dados.mes} | Semana: ${dados.semana}`];
  wsData[row++] = [];
  return row;
}

// Bloco 3: Movimentação por Divisão
function adicionarBlocoMovimentacao(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['MOVIMENTAÇÃO POR DIVISÃO'];
  wsData[row++] = ['Divisão', 'Entradas', 'Saídas', 'Saldo'];
  
  let totalEntradas = 0;
  let totalSaidas = 0;
  
  dados.divisoes.forEach(div => {
    const entradas = div.relatorio?.entradas_json?.length || 0;
    const saidas = div.relatorio?.saidas_json?.length || 0;
    const saldo = entradas - saidas;
    
    wsData[row++] = [div.divisao_nome, entradas, saidas, saldo];
    
    totalEntradas += entradas;
    totalSaidas += saidas;
  });
  
  wsData[row++] = ['TOTAL', totalEntradas, totalSaidas, totalEntradas - totalSaidas];
  wsData[row++] = [];
  return row;
}

// Bloco 4: Crescimento Atual
function adicionarBlocoCrescimentoAtual(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CRESCIMENTO ATUAL'];
  wsData[row++] = ['Divisão', 'Mês Anterior', 'Total Atual', 'Crescimento'];
  
  let totalAtualGeral = 0;
  
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    const totalAtual = (stats.total_tem_moto || 0) + (stats.total_tem_carro || 0) + (stats.total_sem_veiculo || 0);
    
    wsData[row++] = [
      div.divisao_nome,
      '-', // Não temos por divisão individual do mês anterior
      totalAtual,
      '-'
    ];
    
    totalAtualGeral += totalAtual;
  });
  
  const crescimento = dados.total_mes_anterior > 0 
    ? ((totalAtualGeral - dados.total_mes_anterior) / dados.total_mes_anterior * 100).toFixed(1) + '%'
    : '-';
  
  wsData[row++] = ['TOTAL', dados.total_mes_anterior, totalAtualGeral, crescimento];
  wsData[row++] = [];
  return row;
}

// Bloco 5: Efetivo por Veículo
function adicionarBlocoEfetivo(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['EFETIVO POR VEÍCULO'];
  wsData[row++] = ['Divisão', 'Moto', '%', 'Carro', '%', 'Sem Veículo', '%', 'Total'];
  
  let totalMoto = 0;
  let totalCarro = 0;
  let totalSemVeiculo = 0;
  let totalGeral = 0;
  
  // Calcular totais primeiro
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    totalMoto += stats.total_tem_moto || 0;
    totalCarro += stats.total_tem_carro || 0;
    totalSemVeiculo += stats.total_sem_veiculo || 0;
  });
  totalGeral = totalMoto + totalCarro + totalSemVeiculo;
  
  // Adicionar linhas com percentuais
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    const moto = stats.total_tem_moto || 0;
    const carro = stats.total_tem_carro || 0;
    const semVeiculo = stats.total_sem_veiculo || 0;
    const total = moto + carro + semVeiculo;
    
    const percMoto = totalGeral > 0 ? ((moto / totalGeral) * 100).toFixed(1) + '%' : '0%';
    const percCarro = totalGeral > 0 ? ((carro / totalGeral) * 100).toFixed(1) + '%' : '0%';
    const percSem = totalGeral > 0 ? ((semVeiculo / totalGeral) * 100).toFixed(1) + '%' : '0%';
    
    wsData[row++] = [div.divisao_nome, moto, percMoto, carro, percCarro, semVeiculo, percSem, total];
  });
  
  wsData[row++] = ['TOTAL', totalMoto, '100%', totalCarro, '100%', totalSemVeiculo, '100%', totalGeral];
  wsData[row++] = [];
  return row;
}

// Bloco 6: Inadimplência
function adicionarBlocoInadimplencia(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['INADIMPLÊNCIA POR DIVISÃO'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let totalQtd = 0;
  
  dados.divisoes.forEach(div => {
    const inadimplencias = div.relatorio?.inadimplencias_json || [];
    const qtd = inadimplencias.length;
    
    wsData[row++] = [div.divisao_nome, qtd];
    
    totalQtd += qtd;
  });
  
  wsData[row++] = ['TOTAL', totalQtd];
  wsData[row++] = [];
  return row;
}

// Bloco 7: Ações de Inadimplência
function adicionarBlocoAcoesInadimplencia(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['AÇÕES DE INADIMPLÊNCIA'];
  wsData[row++] = ['Divisão', 'Nome', 'Ação de Cobrança'];
  
  let temAcoes = false;
  
  dados.divisoes.forEach(div => {
    const inadimplencias = div.relatorio?.inadimplencias_json || [];
    inadimplencias.forEach((inad: any) => {
      if (inad.acao_cobranca) {
        wsData[row++] = [
          div.divisao_nome,
          inad.nome_colete || '',
          inad.acao_cobranca || ''
        ];
        temAcoes = true;
      }
    });
  });
  
  if (!temAcoes) {
    wsData[row++] = ['Sem ações de inadimplência'];
  }
  
  wsData[row++] = [];
  return row;
}

// Bloco 8: Entradas e Saídas Detalhado
function adicionarBlocoEntradasSaidas(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['ENTRADAS E SAÍDAS DETALHADO'];
  wsData[row++] = ['Tipo', 'Divisão', 'Nome', 'Data', 'Motivo'];
  
  let temMovimentacoes = false;
  
  dados.divisoes.forEach(div => {
    // Entradas
    const entradas = div.relatorio?.entradas_json || [];
    entradas.forEach((entrada: any) => {
      wsData[row++] = [
        'ENTRADA',
        div.divisao_nome,
        entrada.nome_colete || '',
        entrada.data_entrada || '',
        entrada.motivo_entrada || ''
      ];
      temMovimentacoes = true;
    });
    
    // Saídas
    const saidas = div.relatorio?.saidas_json || [];
    saidas.forEach((saida: any) => {
      wsData[row++] = [
        'SAÍDA',
        div.divisao_nome,
        saida.nome_colete || '',
        saida.data_saida || '',
        saida.justificativa || saida.motivo_codigo || ''
      ];
      temMovimentacoes = true;
    });
  });
  
  if (!temMovimentacoes) {
    wsData[row++] = ['Sem movimentações'];
  }
  
  wsData[row++] = [];
  return row;
}

// Bloco 9: Conflitos Internos
function adicionarBlocoConflitosInternos(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CONFLITOS INTERNOS'];
  wsData[row++] = ['Divisão', 'Data', 'Descrição', 'Status'];
  
  let temConflitos = false;
  
  dados.divisoes.forEach(div => {
    const conflitos = div.relatorio?.conflitos_json || [];
    conflitos.forEach((conflito: any) => {
      wsData[row++] = [
        div.divisao_nome,
        conflito.data || '',
        conflito.descricao || '',
        conflito.status || ''
      ];
      temConflitos = true;
    });
  });
  
  if (!temConflitos) {
    wsData[row++] = ['Sem conflitos'];
  }
  
  wsData[row++] = [];
  return row;
}

// Bloco 10: Conflitos Externos
function adicionarBlocoConflitosExternos(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CONFLITOS EXTERNOS'];
  wsData[row++] = ['Divisão', 'Data', 'Descrição', 'Status'];
  
  // Nota: Atualmente conflitos_json não diferencia interno/externo
  // Mostrando os mesmos dados como placeholder
  let temConflitos = false;
  
  dados.divisoes.forEach(div => {
    const conflitos = div.relatorio?.conflitos_json || [];
    conflitos.forEach((conflito: any) => {
      wsData[row++] = [
        div.divisao_nome,
        conflito.data || '',
        conflito.descricao || '',
        conflito.status || ''
      ];
      temConflitos = true;
    });
  });
  
  if (!temConflitos) {
    wsData[row++] = ['Sem conflitos'];
  }
  
  wsData[row++] = [];
  return row;
}

// Bloco 11: Ações Sociais
function adicionarBlocoAcoesSociais(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['AÇÕES SOCIAIS'];
  wsData[row++] = ['Divisão', 'Título', 'Data'];
  
  let temAcoes = false;
  
  dados.divisoes.forEach(div => {
    const acoes = div.relatorio?.acoes_sociais_json || [];
    acoes.forEach((acao: any) => {
      wsData[row++] = [
        div.divisao_nome,
        acao.titulo || '',
        acao.data_acao || ''
      ];
      temAcoes = true;
    });
  });
  
  if (!temAcoes) {
    wsData[row++] = ['Sem ações sociais'];
  }
  
  wsData[row++] = [];
  return row;
}

// Bloco 12: Batedores
function adicionarBlocoBatedores(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['BATEDORES'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    const qtd = stats.total_batedores || 0;
    
    wsData[row++] = [div.divisao_nome, qtd];
    total += qtd;
  });
  
  wsData[row++] = ['TOTAL', total];
  wsData[row++] = [];
  return row;
}

// Bloco 13: Caveiras
function adicionarBlocoCaveiras(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CAVEIRAS'];
  wsData[row++] = ['Divisão', 'Caveiras', 'Suplentes'];
  
  let totalCaveiras = 0;
  let totalSuplentes = 0;
  
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    const caveiras = stats.total_caveiras || 0;
    const suplentes = stats.total_suplentes_caveira || 0;
    
    wsData[row++] = [div.divisao_nome, caveiras, suplentes];
    
    totalCaveiras += caveiras;
    totalSuplentes += suplentes;
  });
  
  wsData[row++] = ['TOTAL', totalCaveiras, totalSuplentes];
  wsData[row++] = [];
  return row;
}

// Bloco 14: Combate Insano
function adicionarBlocoCombateInsano(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMBATE INSANO'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.divisoes.forEach(div => {
    const stats = div.relatorio?.estatisticas_divisao_json || {};
    const qtd = stats.total_combate_insano || 0;
    
    wsData[row++] = [div.divisao_nome, qtd];
    total += qtd;
  });
  
  wsData[row++] = ['TOTAL', total];
  wsData[row++] = [];
  return row;
}

// ============================================================================
// GERAÇÃO DO XLSX
// ============================================================================

function generateXlsxReport(dados: DadosRelatorio): ArrayBuffer {
  const wsData: any[][] = [];
  
  let row = 0;
  row = adicionarCabecalhoRegional(wsData, dados, row);
  row = adicionarPeriodo(wsData, dados, row);
  row = adicionarBlocoMovimentacao(wsData, dados, row);
  row = adicionarBlocoCrescimentoAtual(wsData, dados, row); // NOVO
  row = adicionarBlocoEfetivo(wsData, dados, row);
  row = adicionarBlocoInadimplencia(wsData, dados, row);
  row = adicionarBlocoAcoesInadimplencia(wsData, dados, row);
  row = adicionarBlocoEntradasSaidas(wsData, dados, row);
  row = adicionarBlocoConflitosInternos(wsData, dados, row);
  row = adicionarBlocoConflitosExternos(wsData, dados, row); // NOVO
  row = adicionarBlocoAcoesSociais(wsData, dados, row);
  row = adicionarBlocoBatedores(wsData, dados, row);
  row = adicionarBlocoCaveiras(wsData, dados, row);
  row = adicionarBlocoCombateInsano(wsData, dados, row);
  
  // Criar worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Configurar largura das colunas (A=45, B-E=15)
  ws['!cols'] = [
    { wch: 45 }, // A - Divisão/Nomes
    { wch: 15 }, // B
    { wch: 15 }, // C
    { wch: 15 }, // D
    { wch: 15 }, // E
    { wch: 15 }, // F
    { wch: 15 }, // G
    { wch: 15 }, // H
  ];
  
  // Criar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório CMD');
  
  // Gerar buffer usando type: 'array' para compatibilidade com Deno
  const uint8Array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(uint8Array).buffer;
}

// ============================================================================
// HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { regional_id, ano, mes, semana } = await req.json();

    console.log('[Export CMD] Parâmetros:', { regional_id, ano, mes, semana });

    // Validar parâmetros
    if (!regional_id || !ano || !mes || !semana) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: regional_id, ano, mes, semana' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados (1 query principal)
    console.log('[Export CMD] Buscando dados...');
    const dados = await fetchDadosRelatorio(regional_id, ano, mes, semana);

    // Gerar XLSX em memória
    console.log('[Export CMD] Gerando XLSX...');
    const xlsxBuffer = generateXlsxReport(dados);

    console.log('[Export CMD] Sucesso! Tamanho:', xlsxBuffer.byteLength, 'bytes');

    return new Response(xlsxBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Relatorio_CMD_${ano}_${mes}_Sem${semana}.xlsx"`
      }
    });

  } catch (error) {
    console.error('[Export CMD] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao gerar relatório'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
