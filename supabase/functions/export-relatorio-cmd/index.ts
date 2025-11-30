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

interface DadosRelatorio {
  regional_nome: string;
  ano: number;
  mes: number;
  semana: number;
  relatorios: RelatorioSemanalDivisao[];
}

// Normaliza nome de divisão para matching
function normalizeDivisaoNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  // Buscar regional
  const { data: regional, error: regionalError } = await supabase
    .from('regionais')
    .select('nome')
    .eq('id', regional_id)
    .single();

  if (regionalError) throw new Error(`Erro ao buscar regional: ${regionalError.message}`);

  // Buscar TODOS os relatórios semanais das divisões (já com dados processados nos JSONs)
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

  console.log('[Fetch Dados] Relatórios encontrados:', relatorios?.length || 0);

  return {
    regional_nome: regional.nome,
    ano,
    mes,
    semana,
    relatorios: relatorios || []
  };
}

// ============================================================================
// BLOCOS DO RELATÓRIO
// ============================================================================

// Bloco 1: Cabeçalho Regional
function adicionarCabecalhoRegional(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMANDO METROPOLITANO'];
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
  
  dados.relatorios.forEach(rel => {
    const entradas = rel.entradas_json?.length || 0;
    const saidas = rel.saidas_json?.length || 0;
    const saldo = entradas - saidas;
    
    wsData[row++] = [rel.divisao_relatorio_texto, entradas, saidas, saldo];
    
    totalEntradas += entradas;
    totalSaidas += saidas;
  });
  
  wsData[row++] = ['TOTAL', totalEntradas, totalSaidas, totalEntradas - totalSaidas];
  wsData[row++] = [];
  return row;
}

// Bloco 4: Efetivo por Veículo
function adicionarBlocoEfetivo(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['EFETIVO POR VEÍCULO'];
  wsData[row++] = ['Divisão', 'Moto', 'Carro', 'Sem Veículo', 'Total'];
  
  let totalMoto = 0;
  let totalCarro = 0;
  let totalSemVeiculo = 0;
  let totalGeral = 0;
  
  dados.relatorios.forEach(rel => {
    const stats = rel.estatisticas_divisao_json || {};
    const moto = stats.total_tem_moto || 0;
    const carro = stats.total_tem_carro || 0;
    const semVeiculo = stats.total_sem_veiculo || 0;
    const total = moto + carro + semVeiculo;
    
    wsData[row++] = [rel.divisao_relatorio_texto, moto, carro, semVeiculo, total];
    
    totalMoto += moto;
    totalCarro += carro;
    totalSemVeiculo += semVeiculo;
    totalGeral += total;
  });
  
  wsData[row++] = ['TOTAL', totalMoto, totalCarro, totalSemVeiculo, totalGeral];
  wsData[row++] = [];
  return row;
}

// Bloco 5: Inadimplência
function adicionarBlocoInadimplencia(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['INADIMPLÊNCIA POR DIVISÃO'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let totalQtd = 0;
  
  dados.relatorios.forEach(rel => {
    const inadimplencias = rel.inadimplencias_json || [];
    const qtd = inadimplencias.length;
    
    wsData[row++] = [rel.divisao_relatorio_texto, qtd];
    
    totalQtd += qtd;
  });
  
  wsData[row++] = ['TOTAL', totalQtd];
  wsData[row++] = [];
  return row;
}

// Bloco 6: Ações de Inadimplência
function adicionarBlocoAcoesInadimplencia(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['AÇÕES DE INADIMPLÊNCIA'];
  wsData[row++] = ['Divisão', 'Nome', 'Ação de Cobrança'];
  
  dados.relatorios.forEach(rel => {
    const inadimplencias = rel.inadimplencias_json || [];
    inadimplencias.forEach((inad: any) => {
      if (inad.acao_cobranca) {
        wsData[row++] = [
          rel.divisao_relatorio_texto,
          inad.nome_colete || '',
          inad.acao_cobranca || ''
        ];
      }
    });
  });
  
  wsData[row++] = [];
  return row;
}

// Bloco 7: Entradas e Saídas Detalhado
function adicionarBlocoEntradasSaidas(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['ENTRADAS E SAÍDAS DETALHADO'];
  wsData[row++] = ['Tipo', 'Divisão', 'Nome', 'Data', 'Motivo'];
  
  dados.relatorios.forEach(rel => {
    // Entradas
    const entradas = rel.entradas_json || [];
    entradas.forEach((entrada: any) => {
      wsData[row++] = [
        'ENTRADA',
        rel.divisao_relatorio_texto,
        entrada.nome_colete || '',
        entrada.data_entrada || '',
        entrada.motivo_entrada || ''
      ];
    });
    
    // Saídas
    const saidas = rel.saidas_json || [];
    saidas.forEach((saida: any) => {
      wsData[row++] = [
        'SAÍDA',
        rel.divisao_relatorio_texto,
        saida.nome_colete || '',
        saida.data_saida || '',
        saida.justificativa || saida.motivo_codigo || ''
      ];
    });
  });
  
  wsData[row++] = [];
  return row;
}

// Bloco 8: Conflitos Internos
function adicionarBlocoConflitos(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CONFLITOS INTERNOS'];
  wsData[row++] = ['Divisão', 'Data', 'Descrição', 'Status'];
  
  dados.relatorios.forEach(rel => {
    const conflitos = rel.conflitos_json || [];
    conflitos.forEach((conflito: any) => {
      wsData[row++] = [
        rel.divisao_relatorio_texto,
        conflito.data || '',
        conflito.descricao || '',
        conflito.status || ''
      ];
    });
  });
  
  wsData[row++] = [];
  return row;
}

// Bloco 9: Ações Sociais
function adicionarBlocoAcoesSociais(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['AÇÕES SOCIAIS'];
  wsData[row++] = ['Divisão', 'Título', 'Data'];
  
  dados.relatorios.forEach(rel => {
    const acoes = rel.acoes_sociais_json || [];
    acoes.forEach((acao: any) => {
      wsData[row++] = [
        rel.divisao_relatorio_texto,
        acao.titulo || '',
        acao.data_acao || ''
      ];
    });
  });
  
  wsData[row++] = [];
  return row;
}

// Bloco 10: Batedores
function adicionarBlocoBatedores(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['BATEDORES'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.relatorios.forEach(rel => {
    const stats = rel.estatisticas_divisao_json || {};
    const qtd = stats.total_batedores || 0;
    
    wsData[row++] = [rel.divisao_relatorio_texto, qtd];
    total += qtd;
  });
  
  wsData[row++] = ['TOTAL', total];
  wsData[row++] = [];
  return row;
}

// Bloco 11: Caveiras
function adicionarBlocoCaveiras(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['CAVEIRAS'];
  wsData[row++] = ['Divisão', 'Caveiras', 'Suplentes'];
  
  let totalCaveiras = 0;
  let totalSuplentes = 0;
  
  dados.relatorios.forEach(rel => {
    const stats = rel.estatisticas_divisao_json || {};
    const caveiras = stats.total_caveiras || 0;
    const suplentes = stats.total_suplentes_caveira || 0;
    
    wsData[row++] = [rel.divisao_relatorio_texto, caveiras, suplentes];
    
    totalCaveiras += caveiras;
    totalSuplentes += suplentes;
  });
  
  wsData[row++] = ['TOTAL', totalCaveiras, totalSuplentes];
  wsData[row++] = [];
  return row;
}

// Bloco 12: Combate Insano
function adicionarBlocoCombateInsano(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMBATE INSANO'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.relatorios.forEach(rel => {
    const stats = rel.estatisticas_divisao_json || {};
    const qtd = stats.total_combate_insano || 0;
    
    wsData[row++] = [rel.divisao_relatorio_texto, qtd];
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
  row = adicionarBlocoEfetivo(wsData, dados, row);
  row = adicionarBlocoInadimplencia(wsData, dados, row);
  row = adicionarBlocoAcoesInadimplencia(wsData, dados, row);
  row = adicionarBlocoEntradasSaidas(wsData, dados, row);
  row = adicionarBlocoConflitos(wsData, dados, row);
  row = adicionarBlocoAcoesSociais(wsData, dados, row);
  row = adicionarBlocoBatedores(wsData, dados, row);
  row = adicionarBlocoCaveiras(wsData, dados, row);
  row = adicionarBlocoCombateInsano(wsData, dados, row);
  
  // Criar worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Configurar largura das colunas
  ws['!cols'] = [
    { wch: 15 }, // A
    { wch: 12 }, // B
    { wch: 12 }, // C
    { wch: 15 }, // D
    { wch: 30 }, // E (descrições)
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
