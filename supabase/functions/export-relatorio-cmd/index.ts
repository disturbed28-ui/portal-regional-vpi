import ExcelJS from 'npm:exceljs@4.4.0';
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
    lobos: number;
    ursinhos: number;
    nomes_caveiras: string[];
    nomes_caveiras_suplentes: string[];
    nomes_lobos: string[];
    nomes_ursinhos: string[];
    nomes_batedores: string[];
    nomes_sgt_armas: string[];
    nomes_combate_insano: string[];
  };
}

interface ExpansaoCandidatoRelatorio {
  nome_colete: string | null;
  telefone: string | null;
  data_recebimento: string | null;
  contato_em: string | null;
  status: string | null;
  baixa_observacao: string | null;
}

interface DadosRelatorio {
  regional_nome: string;
  regional_numero_romano: string;
  ano: number;
  mes: number;
  semana: number;
  divisoes: DivisaoCompleta[];
  expansao_candidatos: ExpansaoCandidatoRelatorio[];
  total_mes_anterior: number;
  dados_mes_anterior: DadosMesAnterior;
  dados_integrantes_ativos: DadosIntegrantesAtivos;
  total_integrantes_ativos: number;
  mapNomeParaNomeAscii: Map<string, string>;
  /** Map UUID integrante_portal -> registro_id (numero) */
  mapIntegranteIdToRegistro: Map<string, number>;
  /** Map nome_colete (upper) -> registro_id (numero) */
  mapNomeColeteToRegistro: Map<string, number>;
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
    .select('id, registro_id, nome_colete, divisao_texto, tem_moto, tem_carro, sgt_armas, combate_insano, batedor, caveira, caveira_suplente, lobo, ursinho')
    .eq('ativo', true)
    .eq('regional_id', regional_id);

  if (integrantesError) throw new Error(`Erro ao buscar integrantes: ${integrantesError.message}`);

  // Mapas auxiliares para resolução de número de integrante (registro_id)
  const mapIntegranteIdToRegistro = new Map<string, number>();
  const mapNomeColeteToRegistro = new Map<string, number>();
  (integrantesAtivos || []).forEach((i: any) => {
    if (i.id && i.registro_id != null) mapIntegranteIdToRegistro.set(i.id, i.registro_id);
    if (i.nome_colete && i.registro_id != null) {
      mapNomeColeteToRegistro.set(String(i.nome_colete).trim().toUpperCase(), i.registro_id);
    }
  });

  // Também buscar inativos para resolver registro_id de saídas/inadimplência
  const { data: integrantesTodos } = await supabase
    .from('integrantes_portal')
    .select('id, registro_id, nome_colete')
    .eq('regional_id', regional_id);
  (integrantesTodos || []).forEach((i: any) => {
    if (i.id && i.registro_id != null && !mapIntegranteIdToRegistro.has(i.id)) {
      mapIntegranteIdToRegistro.set(i.id, i.registro_id);
    }
    if (i.nome_colete && i.registro_id != null) {
      const key = String(i.nome_colete).trim().toUpperCase();
      if (!mapNomeColeteToRegistro.has(key)) mapNomeColeteToRegistro.set(key, i.registro_id);
    }
  });

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
        caveiras: 0, caveiras_suplentes: 0,
        lobos: 0, ursinhos: 0,
        nomes_caveiras: [], nomes_caveiras_suplentes: [],
        nomes_lobos: [], nomes_ursinhos: [],
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
    if (integrante.caveira) { stats.caveiras++; stats.nomes_caveiras.push(integrante.nome_colete); }
    if (integrante.caveira_suplente) { stats.caveiras_suplentes++; stats.nomes_caveiras_suplentes.push(integrante.nome_colete); }
    if (integrante.lobo) { stats.lobos++; stats.nomes_lobos.push(integrante.nome_colete); }
    if (integrante.ursinho) { stats.ursinhos++; stats.nomes_ursinhos.push(integrante.nome_colete); }
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

  // 7. Buscar candidatos de Expansão da regional
  // Critério: data_recebimento dentro do período OU status ainda não encerrado
  // (encerrado = efetivado_reportado, desistente_reportado, cancelado)
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  let diaInicio = 1;
  let diaFim = ultimoDiaMes;
  if (semana === 1) { diaInicio = 1; diaFim = 10; }
  else if (semana === 2) { diaInicio = 11; diaFim = 20; }
  else { diaInicio = 21; diaFim = ultimoDiaMes; }
  const dataInicioPeriodo = `${ano}-${String(mes).padStart(2, '0')}-${String(diaInicio).padStart(2, '0')}`;
  const dataFimPeriodo = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFim).padStart(2, '0')}`;

  const STATUS_ENCERRADOS = ['efetivado_reportado', 'desistente_reportado', 'cancelado'];

  const { data: candidatosExpansao, error: expansaoError } = await supabase
    .from('expansao_candidatos')
    .select('nome_colete, telefone, data_recebimento, contato_em, status, baixa_observacao')
    .eq('regional_id', regional_id)
    .order('data_recebimento', { ascending: true });

  if (expansaoError) console.error('[Fetch Dados] Erro ao buscar expansão:', expansaoError.message);

  const expansaoFiltrada: ExpansaoCandidatoRelatorio[] = (candidatosExpansao || []).filter((c: any) => {
    const dentroPeriodo = c.data_recebimento &&
      c.data_recebimento >= dataInicioPeriodo &&
      c.data_recebimento <= dataFimPeriodo;
    const naoEncerrado = !STATUS_ENCERRADOS.includes(c.status);
    return dentroPeriodo || naoEncerrado;
  });

  console.log('[Fetch Dados] Candidatos expansão no relatório:', expansaoFiltrada.length);

  return {
    regional_nome: regional.nome,
    regional_numero_romano: extrairNumeroRomano(regional.nome),
    ano,
    mes,
    semana,
    divisoes: ordenarDivisoes(divisoesCompletas),
    expansao_candidatos: expansaoFiltrada,
    total_mes_anterior: totalMesAnterior,
    dados_mes_anterior: dadosMesAnterior,
    dados_integrantes_ativos: dadosIntegrantesAtivos,
    total_integrantes_ativos: totalGeralAtivos,
    mapNomeParaNomeAscii: mapNomeParaNomeAscii, // Retornar mapa para uso nos blocos
    mapIntegranteIdToRegistro,
    mapNomeColeteToRegistro
  };
}

// ============================================================================
// BLOCOS DO RELATÓRIO
// ============================================================================

// Bloco 1: Cabeçalho Regional
function adicionarCabecalhoRegional(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['COMANDO REGIONAL V'];
  wsData[row++] = [`REGIONAL ${dados.regional_nome.toUpperCase()}`];
  wsData[row++] = ['RELATÓRIO CMD'];
  wsData[row++] = [];
  return row;
}

// Bloco 2: Período (label do range conforme número do período: 01-10, 11-20, 21-fim)
function adicionarPeriodo(wsData: any[][], dados: DadosRelatorio, row: number): number {
  // Calcular range a partir do mes/ano/semana
  const ultimoDiaMes = new Date(dados.ano, dados.mes, 0).getDate();
  let labelRange = '';
  if (dados.semana === 1) labelRange = '01–10';
  else if (dados.semana === 2) labelRange = '11–20';
  else labelRange = `21–${String(ultimoDiaMes).padStart(2, '0')}`;

  wsData[row++] = ['PERÍODO'];
  wsData[row++] = [`Ano: ${dados.ano} | Mês: ${dados.mes} | Período ${dados.semana} (${labelRange})`];
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

// Helper: resolve número do integrante (registro_id)
function resolverRegistro(dados: DadosRelatorio, integrante_id?: string, nome_colete?: string): string {
  if (integrante_id && dados.mapIntegranteIdToRegistro.has(integrante_id)) {
    return String(dados.mapIntegranteIdToRegistro.get(integrante_id));
  }
  if (nome_colete) {
    const key = String(nome_colete).trim().toUpperCase();
    if (dados.mapNomeColeteToRegistro.has(key)) {
      return String(dados.mapNomeColeteToRegistro.get(key));
    }
  }
  return '';
}

// Bloco 7: Ações de Inadimplência
function adicionarBlocoAcoesInadimplencia(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['AÇÕES DE INADIMPLÊNCIA'];
  wsData[row++] = ['Divisão', 'Nº Integrante', 'Nome', 'Ação de Cobrança'];

  let temAcoes = false;

  dados.divisoes.forEach(div => {
    const inadimplencias = div.relatorio?.inadimplencias_json || [];
    inadimplencias.forEach((inad: any) => {
      const numero = resolverRegistro(dados, inad.integrante_id, inad.nome_colete);
      wsData[row++] = [
        div.divisao_nome,
        numero,
        inad.nome_colete || '',
        inad.acao_cobranca || '-'
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
  wsData[row++] = ['Tipo', 'Divisão', 'Nº Integrante', 'Nome', 'Data', 'Motivo'];

  let temMovimentacoes = false;

  dados.divisoes.forEach(div => {
    const entradas = div.relatorio?.entradas_json || [];
    entradas.forEach((entrada: any) => {
      wsData[row++] = [
        'ENTRADA',
        div.divisao_nome,
        resolverRegistro(dados, entrada.integrante_id, entrada.nome_colete),
        entrada.nome_colete || '',
        entrada.data_entrada || '',
        entrada.motivo_entrada || ''
      ];
      temMovimentacoes = true;
    });

    const saidas = div.relatorio?.saidas_json || [];
    saidas.forEach((saida: any) => {
      wsData[row++] = [
        'SAÍDA',
        div.divisao_nome,
        resolverRegistro(dados, saida.integrante_id, saida.nome_colete),
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

// Bloco 16: Lobos (com nomes por divisão)
function adicionarBlocoLobos(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['LOBOS'];
  wsData[row++] = ['Divisão', 'Nomes', 'Subtotal'];

  let totalGeral = 0;

  dados.divisoes.forEach(div => {
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    const stats = dados.dados_integrantes_ativos[chaveAtivos];
    const nomes = stats?.nomes_lobos || [];

    wsData[row++] = [div.divisao_nome, nomes.length === 0 ? '-' : nomes.join(', '), nomes.length];
    totalGeral += nomes.length;
  });

  wsData[row++] = ['TOTAL GERAL', '', totalGeral];
  wsData[row++] = [];
  return row;
}

// Bloco 17: Ursinhos (com nomes por divisão)
function adicionarBlocoUrsinhos(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['URSINHOS'];
  wsData[row++] = ['Divisão', 'Nomes', 'Subtotal'];

  let totalGeral = 0;

  dados.divisoes.forEach(div => {
    const nomeAscii = dados.mapNomeParaNomeAscii.get(div.divisao_nome) || div.divisao_nome.toUpperCase();
    const chaveAtivos = nomeAscii.toUpperCase();
    const stats = dados.dados_integrantes_ativos[chaveAtivos];
    const nomes = stats?.nomes_ursinhos || [];

    wsData[row++] = [div.divisao_nome, nomes.length === 0 ? '-' : nomes.join(', '), nomes.length];
    totalGeral += nomes.length;
  });

  wsData[row++] = ['TOTAL GERAL', '', totalGeral];
  wsData[row++] = [];
  return row;
}

// Helper: formata data ISO (YYYY-MM-DD) para DD/MM/YYYY
function formatarDataBR(data: string | null): string {
  if (!data) return '-';
  const apenasData = String(data).split('T')[0];
  const partes = apenasData.split('-');
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Bloco 18: Expansão (regional, no final do relatório)
function adicionarBlocoExpansao(wsData: any[][], dados: DadosRelatorio, row: number): number {
  wsData[row++] = ['EXPANSÃO'];
  wsData[row++] = ['Nome de colete', 'Telefone', 'Data de recebimento da ficha', 'Data de contato', 'Converteu', 'Motivo/Observação'];

  const candidatos = dados.expansao_candidatos || [];

  if (candidatos.length === 0) {
    wsData[row++] = ['Sem candidatos de expansão'];
  } else {
    candidatos.forEach(c => {
      let converteu = '-';
      if (c.status === 'efetivado' || c.status === 'efetivado_reportado') converteu = 'Sim';
      else if (c.status === 'desistente' || c.status === 'desistente_reportado') converteu = 'Não';

      wsData[row++] = [
        c.nome_colete || '-',
        c.telefone || '-',
        formatarDataBR(c.data_recebimento),
        formatarDataBR(c.contato_em),
        converteu,
        c.baixa_observacao || '-',
      ];
    });
  }

  wsData[row++] = [];
  return row;
}

// ============================================================================
// GERAÇÃO DO XLSX
// ============================================================================

// Palavras que identificam um título de bloco (mesma lista da macro VBA)
const BLOCK_TITLE_KEYWORDS = [
  'MOVIMENTAÇÃO', 'CRESCIMENTO', 'EFETIVO', 'INADIMPLÊNCIA',
  'AÇÕES DE', 'AÇÕES SOCIAIS', 'ENTRADAS', 'CONFLITOS',
  'BATEDORES', 'CAVEIRAS', 'SGT ARMAS', 'COMBATE', 'LOBOS', 'URSINHOS',
  'EXPANSÃO', 'PERÍODO',
];


function isBlockTitle(value: any): boolean {
  if (typeof value !== 'string') return false;
  const upper = value.trim().toUpperCase();
  if (!upper) return false;
  return BLOCK_TITLE_KEYWORDS.some(kw => upper.includes(kw));
}

async function generateXlsxReport(dados: DadosRelatorio): Promise<ArrayBuffer> {
  const wsData: any[][] = [];

  let row = 0;
  row = adicionarCabecalhoRegional(wsData, dados, row);
  row = adicionarPeriodo(wsData, dados, row);
  row = adicionarBlocoMovimentacao(wsData, dados, row);
  row = adicionarBlocoCrescimentoAtual(wsData, dados, row);
  row = adicionarBlocoEfetivo(wsData, dados, row);
  row = adicionarBlocoInadimplencia(wsData, dados, row);
  row = adicionarBlocoAcoesInadimplencia(wsData, dados, row);
  row = adicionarBlocoEntradasSaidas(wsData, dados, row);
  row = adicionarBlocoConflitosInternos(wsData, dados, row);
  row = adicionarBlocoConflitosExternos(wsData, dados, row);
  row = adicionarBlocoAcoesSociais(wsData, dados, row);
  row = adicionarBlocoBatedores(wsData, dados, row);
  row = adicionarBlocoCaveiras(wsData, dados, row);
  row = adicionarBlocoSgtArmas(wsData, dados, row);
  row = adicionarBlocoCombateInsano(wsData, dados, row);
  row = adicionarBlocoLobos(wsData, dados, row);
  row = adicionarBlocoUrsinhos(wsData, dados, row);
  row = adicionarBlocoExpansao(wsData, dados, row);

  // Criar workbook ExcelJS com formatação completa (equivalente à macro VBA)
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal Regional V';
  wb.created = new Date();
  const ws = wb.addWorksheet('Relatório CMD');

  // ===== Pós-processar wsData: reestruturar AÇÕES SOCIAIS e ENTRADAS para mesclagens =====
  // AÇÕES SOCIAIS: A=Divisão, B:C=Título, D:G=Descrição, H=Data
  // ENTRADAS E SAÍDAS DETALHADO: A=Tipo, B=Divisão, C=Nº, D=Nome, E=Data, F:H=Motivo
  const merges: string[] = [];
  for (let i = 0; i < wsData.length; i++) {
    const linha = wsData[i];
    if (!linha || !linha[0]) continue;
    const titulo = String(linha[0]).trim().toUpperCase();

    if (titulo === 'AÇÕES SOCIAIS') {
      // Reescreve linhas seguintes até linha vazia / próximo título
      let j = i + 1;
      while (j < wsData.length) {
        const r = wsData[j];
        if (!r || r.length === 0 || (r[0] === undefined || r[0] === null || (typeof r[0] === 'string' && r[0].trim() === ''))) break;
        const t0 = String(r[0]).trim().toUpperCase();
        if (j > i + 1 && isBlockTitle(r[0])) break;
        if (t0 === 'SEM AÇÕES SOCIAIS') { j++; break; }
        // Esperado: [div, titulo, descricao, data] (cabeçalho ou dados)
        const div = r[0] ?? '';
        const tit = r[1] ?? '';
        const desc = r[2] ?? '';
        const data = r[3] ?? '';
        wsData[j] = [div, tit, '', desc, '', '', '', data];
        // Excel rows são 1-indexed
        const excelRow = j + 1;
        merges.push(`B${excelRow}:C${excelRow}`);
        merges.push(`D${excelRow}:G${excelRow}`);
        j++;
      }
    } else if (titulo === 'ENTRADAS E SAÍDAS DETALHADO') {
      let j = i + 1;
      while (j < wsData.length) {
        const r = wsData[j];
        if (!r || r.length === 0 || (r[0] === undefined || r[0] === null || (typeof r[0] === 'string' && r[0].trim() === ''))) break;
        if (j > i + 1 && isBlockTitle(r[0])) break;
        const t0 = String(r[0]).trim().toUpperCase();
        if (t0 === 'SEM MOVIMENTAÇÕES') { j++; break; }
        const excelRow = j + 1;
        merges.push(`F${excelRow}:H${excelRow}`);
        j++;
      }
    }
  }

  // Larguras de coluna (A=50, B-H=15) — igual ao VBA
  ws.columns = [
    { width: 50 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
  ];

  // Adicionar todas as linhas
  wsData.forEach(rowData => {
    ws.addRow(rowData || []);
  });

  // Estilos reutilizáveis
  const fillTituloBloco: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' },
  };
  const fillCabecalho: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' },
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };

  // ===== Cabeçalho do relatório (linhas 1-3): negrito, fonte 14, centralizado =====
  for (let r = 1; r <= 3; r++) {
    const cell = ws.getCell(r, 1);
    cell.font = { bold: true, size: 14 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // ===== Identificar e formatar blocos =====
  const totalLinhas = ws.rowCount;
  let r = 5; // depois do cabeçalho
  while (r <= totalLinhas) {
    const cellA = ws.getCell(r, 1);
    if (isBlockTitle(cellA.value)) {
      // Título do bloco: negrito, fundo cinza
      cellA.font = { bold: true, size: 11 };
      cellA.fill = fillTituloBloco;
      cellA.border = { bottom: { style: 'thin' } };

      const linhaCabecalho = r + 1;
      if (linhaCabecalho <= totalLinhas) {
        // Detectar quantas colunas o cabeçalho usa
        const cabecalhoRow = ws.getRow(linhaCabecalho);
        let ultimaCol = 1;
        cabecalhoRow.eachCell({ includeEmpty: false }, (_c, colNumber) => {
          if (colNumber > ultimaCol) ultimaCol = colNumber;
        });
        if (ultimaCol < 2) ultimaCol = 2;

        // Formatar cabeçalho (linha r+1): negrito, fundo azul, bordas
        for (let c = 1; c <= ultimaCol; c++) {
          const cell = ws.getCell(linhaCabecalho, c);
          cell.font = { bold: true };
          cell.fill = fillCabecalho;
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Encontrar fim do bloco (linha vazia ou próximo título)
        let linhaFim = linhaCabecalho + 1;
        while (linhaFim <= totalLinhas) {
          const v = ws.getCell(linhaFim, 1).value;
          const isEmpty = v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
          if (isEmpty) { linhaFim--; break; }
          if (linhaFim > linhaCabecalho + 1 && isBlockTitle(v)) { linhaFim--; break; }
          linhaFim++;
        }
        if (linhaFim > totalLinhas) linhaFim = totalLinhas;

        // Aplicar bordas nos dados do bloco
        if (linhaFim >= linhaCabecalho + 1) {
          for (let rr = linhaCabecalho + 1; rr <= linhaFim; rr++) {
            for (let cc = 1; cc <= ultimaCol; cc++) {
              const cell = ws.getCell(rr, cc);
              cell.border = thinBorder;
              if (cc >= 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
            }
          }

          // Linha TOTAL (última linha do bloco): negrito + borda superior média
          const ultimoTexto = String(ws.getCell(linhaFim, 1).value || '').trim().toUpperCase();
          if (ultimoTexto === 'TOTAL' || ultimoTexto === 'TOTAL GERAL' || ultimoTexto.startsWith('SEM ')) {
            for (let cc = 1; cc <= ultimoCol(ws, linhaFim, ultimaCol); cc++) {
              const cell = ws.getCell(linhaFim, cc);
              cell.font = { bold: true };
              cell.border = {
                ...thinBorder,
                top: { style: 'medium' },
              };
            }
          }
        }

        r = linhaFim + 2;
        continue;
      }
    }
    r++;
  }

  // Aplicar merges (AÇÕES SOCIAIS e ENTRADAS/SAÍDAS DETALHADO)
  for (const range of merges) {
    try { ws.mergeCells(range); } catch (_e) { /* ignora overlaps */ }
  }

  // Gerar buffer
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// Helper: garante mínimo de colunas para a linha total
function ultimoCol(_ws: ExcelJS.Worksheet, _row: number, ultimaCol: number): number {
  return ultimaCol;
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
    const xlsxBuffer = await generateXlsxReport(dados);

    console.log('[Export CMD] Sucesso! Tamanho:', xlsxBuffer.byteLength, 'bytes');

    return new Response(xlsxBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Relatorio_CMD_${ano}_${mes}_P${semana}.xlsx"`
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
