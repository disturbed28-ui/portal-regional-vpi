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

interface DadosMesAnterior {
  [divisao_nome_normalizado: string]: number;
}

interface DadosIntegrantesAtivos {
  [divisao_nome: string]: {
    total: number;
    moto: number;
    carro: number;
    sem_veiculo: number;
    sgt_armas: number;
    combate_insano: number;
    batedores: number;
    caveiras: number;
    caveiras_suplentes: number;
  };
}

interface DadosRelatorio {
  regional_nome: string;
  regional_numero_romano: string;
  ano: number;
  mes: number;
  semana: number;
  divisoes: DivisaoCompleta[];
  total_mes_anterior: number;
  dados_mes_anterior: DadosMesAnterior;
  dados_integrantes_ativos: DadosIntegrantesAtivos;
  total_integrantes_ativos: number;
  mapNomeParaNomeAscii: Map<string, string>;
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

  // 2. Buscar TODAS as divisões da regional (COM nome_ascii para normalização)
  const { data: divisoes, error: divisoesError } = await supabase
    .from('divisoes')
    .select('id, nome, nome_ascii')
    .eq('regional_id', regional_id)
    .order('nome');

  if (divisoesError) throw new Error(`Erro ao buscar divisões: ${divisoesError.message}`);

  // 2.1. Criar mapa de nome → nome_ascii (para normalização)
  const mapNomeParaNomeAscii = new Map<string, string>();
  divisoes?.forEach(d => {
    mapNomeParaNomeAscii.set(d.nome, d.nome_ascii || d.nome.toUpperCase());
  });

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

  // 4. Buscar dados do mês anterior de cargas_historico
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  
  const { data: cargaMesAnterior } = await supabase
    .from('cargas_historico')
    .select('dados_snapshot, data_carga')
    .eq('tipo_carga', 'integrantes')
    .gte('data_carga', `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`)
    .lt('data_carga', `${ano}-${String(mes).padStart(2, '0')}-01`)
    .order('data_carga', { ascending: false })
    .limit(1)
    .single();

  // Montar mapa de divisão -> total do mês anterior
  const dadosMesAnterior: DadosMesAnterior = {};
  let totalMesAnterior = 0;
  
  if (cargaMesAnterior && cargaMesAnterior.dados_snapshot) {
    const snapshot = cargaMesAnterior.dados_snapshot as any;
    const divisoesSnapshot = snapshot.divisoes || [];
    
    divisoesSnapshot.forEach((div: any) => {
      const nomeNormalizado = (div.divisao || '').toLowerCase().trim();
      const total = div.total || 0;
      dadosMesAnterior[nomeNormalizado] = total;
      totalMesAnterior += total;
    });
    
    console.log('[Fetch Dados] Carga mês anterior:', cargaMesAnterior.data_carga);
    console.log('[Fetch Dados] Total mês anterior:', totalMesAnterior);
  }

  // 5. Buscar integrantes ATIVOS da regional (dados em tempo real)
  const { data: integrantesAtivos, error: integrantesError } = await supabase
    .from('integrantes_portal')
    .select('divisao_texto, tem_moto, tem_carro, sgt_armas, combate_insano, batedor, caveira, caveira_suplente')
    .eq('ativo', true)
    .eq('regional_id', regional_id);

  if (integrantesError) throw new Error(`Erro ao buscar integrantes: ${integrantesError.message}`);

  // Processar dados por divisão
  // IMPORTANTE: usar divisao_texto como chave (já está MAIÚSCULO sem acentos)
  const dadosIntegrantesAtivos: DadosIntegrantesAtivos = {};
  let totalGeralAtivos = 0;

  (integrantesAtivos || []).forEach(integrante => {
    const divisaoChave = integrante.divisao_texto; // JÁ está MAIÚSCULO sem acentos
    if (!dadosIntegrantesAtivos[divisaoChave]) {
      dadosIntegrantesAtivos[divisaoChave] = {
        total: 0, moto: 0, carro: 0, sem_veiculo: 0,
        sgt_armas: 0, combate_insano: 0, batedores: 0,
        caveiras: 0, caveiras_suplentes: 0
      };
    }
    
    const stats = dadosIntegrantesAtivos[divisaoChave];
    stats.total++;
    totalGeralAtivos++;
    
    // Veículos (prioridade: moto > carro > sem veículo)
    if (integrante.tem_moto) stats.moto++;
    else if (integrante.tem_carro) stats.carro++;
    else stats.sem_veiculo++;
    
    // Times especiais
    if (integrante.sgt_armas) stats.sgt_armas++;
    if (integrante.combate_insano) stats.combate_insano++;
    if (integrante.batedor) stats.batedores++;
    if (integrante.caveira) stats.caveiras++;
    if (integrante.caveira_suplente) stats.caveiras_suplentes++;
  });

  console.log('[Fetch Dados] Total integrantes ativos:', totalGeralAtivos);

  // 6. Fazer merge: todas divisões + relatórios
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
    total_mes_anterior: totalMesAnterior,
    dados_mes_anterior: dadosMesAnterior,
    dados_integrantes_ativos: dadosIntegrantesAtivos,
    total_integrantes_ativos: totalGeralAtivos,
    mapNomeParaNomeAscii: mapNomeParaNomeAscii // Retornar mapa para uso nos blocos
  };
}

// ============================================================================
// BLOCOS DO RELATÓRIO
// ============================================================================

// Bloco 1: Cabeçalho Regional
function adicionarCabecalhoRegional(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMANDO REGIONAL V'];
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
  
  let totalMesAnteriorGeral = 0;
  let totalAtualGeral = 0;
  
  dados.divisoes.forEach(div => {
    // Normalizar nome da divisão para MAIÚSCULO sem acentos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const nomeNormalizado = nomeAscii.toLowerCase().trim();
    const mesAnterior = dados.dados_mes_anterior[nomeNormalizado] || 0;
    
    // Buscar total atual de integrantes ativos usando chave normalizada (MAIÚSCULO)
    const chaveAtivos = nomeAscii.toUpperCase();
    const statsAtivos = dados.dados_integrantes_ativos[chaveAtivos] || { total: 0 };
    const totalAtual = statsAtivos.total;
    
    const crescimentoDiv = mesAnterior > 0 
      ? ((totalAtual - mesAnterior) / mesAnterior * 100).toFixed(1) + '%'
      : (totalAtual > 0 ? '+100%' : '-');
    
    wsData[row++] = [div.divisao_nome, mesAnterior, totalAtual, crescimentoDiv];
    
    totalMesAnteriorGeral += mesAnterior;
    totalAtualGeral += totalAtual;
  });
  
  const crescimentoTotal = totalMesAnteriorGeral > 0 
    ? ((totalAtualGeral - totalMesAnteriorGeral) / totalMesAnteriorGeral * 100).toFixed(1) + '%'
    : (totalAtualGeral > 0 ? '+100%' : '-');
  
  wsData[row++] = ['TOTAL', totalMesAnteriorGeral, totalAtualGeral, crescimentoTotal];
  wsData[row++] = [];
  return row;
}

// Bloco 5: Efetivo por Veículo (SEM PERCENTUAIS)
function adicionarBlocoEfetivo(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['EFETIVO POR VEÍCULO'];
  wsData[row++] = ['Divisão', 'Moto', 'Carro', 'Sem Veículo', 'Total'];
  
  let totalMoto = 0;
  let totalCarro = 0;
  let totalSemVeiculo = 0;
  
  dados.divisoes.forEach(div => {
    // Normalizar nome da divisão para buscar dados ativos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    
    // Buscar de integrantes ativos usando chave normalizada
    const stats = dados.dados_integrantes_ativos[chaveAtivos] || {
      moto: 0, carro: 0, sem_veiculo: 0, total: 0
    };
    
    wsData[row++] = [div.divisao_nome, stats.moto, stats.carro, stats.sem_veiculo, stats.total];
    
    totalMoto += stats.moto;
    totalCarro += stats.carro;
    totalSemVeiculo += stats.sem_veiculo;
  });
  
  wsData[row++] = ['TOTAL', totalMoto, totalCarro, totalSemVeiculo, totalMoto + totalCarro + totalSemVeiculo];
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
      // Exportar TODAS as inadimplências, mesmo sem ação descrita
      wsData[row++] = [
        div.divisao_nome,
        inad.nome_colete || '',
        inad.acao_cobranca || '-'  // Usar "-" quando não tem ação
      ];
      temAcoes = true;
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
  wsData[row++] = ['Divisão', 'Título', 'Descrição', 'Data'];
  
  let temAcoes = false;
  
  dados.divisoes.forEach(div => {
    const acoes = div.relatorio?.acoes_sociais_json || [];
    acoes.forEach((acao: any) => {
      wsData[row++] = [
        div.divisao_nome,
        acao.titulo || '',
        acao.descricao || '',
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
    // Normalizar nome da divisão para buscar dados ativos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    
    // Buscar de integrantes ativos usando chave normalizada
    const stats = dados.dados_integrantes_ativos[chaveAtivos] || { batedores: 0 };
    const qtd = stats.batedores;
    
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
    // Normalizar nome da divisão para buscar dados ativos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    
    // Buscar de integrantes ativos usando chave normalizada
    const stats = dados.dados_integrantes_ativos[chaveAtivos] || { 
      caveiras: 0, caveiras_suplentes: 0 
    };
    
    wsData[row++] = [div.divisao_nome, stats.caveiras, stats.caveiras_suplentes];
    
    totalCaveiras += stats.caveiras;
    totalSuplentes += stats.caveiras_suplentes;
  });
  
  wsData[row++] = ['TOTAL', totalCaveiras, totalSuplentes];
  wsData[row++] = [];
  return row;
}

// Bloco 14: Sgt Armas
function adicionarBlocoSgtArmas(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['SGT ARMAS'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.divisoes.forEach(div => {
    // Normalizar nome da divisão para buscar dados ativos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    
    // Buscar de integrantes ativos usando chave normalizada
    const stats = dados.dados_integrantes_ativos[chaveAtivos] || { sgt_armas: 0 };
    const qtd = stats.sgt_armas;
    
    wsData[row++] = [div.divisao_nome, qtd];
    total += qtd;
  });
  
  wsData[row++] = ['TOTAL', total];
  wsData[row++] = [];
  return row;
}

// Bloco 15: Combate Insano
function adicionarBlocoCombateInsano(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMBATE INSANO'];
  wsData[row++] = ['Divisão', 'Quantidade'];
  
  let total = 0;
  
  dados.divisoes.forEach(div => {
    // Normalizar nome da divisão para buscar dados ativos
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    
    // Buscar de integrantes ativos usando chave normalizada
    const stats = dados.dados_integrantes_ativos[chaveAtivos] || { combate_insano: 0 };
    const qtd = stats.combate_insano;
    
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
  row = adicionarBlocoSgtArmas(wsData, dados, row);
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
