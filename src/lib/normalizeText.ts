/**
 * T4: Função centralizada de normalização de texto
 * Usada para matching consistente de regionais, divisões e comandos
 */
export const normalizeText = (text: string): string => {
  if (!text) return "";

  return text
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^COMANDO\s+REGIONAL\s+/i, "")
    .replace(/^REGIONAL\s+/i, "")
    .replace(/^DIVISAO\s+/i, "")
    .replace(/^DIVISÃO\s+/i, "")
    .replace(/\s+-\s+[A-Z]{2}$/i, "")
    .replace(/\s+-\s*$/i, "")
    .replace(/\s+\([^)]*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Normaliza nome de Regional para comparação
 * Exemplos:
 * - "Vale do Paraiba I - SP" → "VALE DO PARAIBA 1"
 * - "REGIONAL VALE DO PARAIBA I - SP" → "VALE DO PARAIBA 1"
 * - "Vale do Paraíba 1" → "VALE DO PARAIBA 1"
 */
export const normalizarRegional = (texto: string): string => {
  if (!texto) return "";
  
  let normalizado = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/^REGIONAL\s*/i, "")     // Remove prefixo "REGIONAL "
    .replace(/(\s*-\s*SP)+$/gi, "")   // Remove MÚLTIPLOS sufixos "- SP"
    .trim();
  
  // Conversão de números romanos para arábicos (mais robusta)
  // Adicionar espaço virtual no início e fim para a regex funcionar corretamente
  normalizado = ` ${normalizado} `
    .replace(/\sIII\s/g, " 3 ")
    .replace(/\sII\s/g, " 2 ")
    .replace(/\sI\s/g, " 1 ")
    .replace(/\s+/g, " ")
    .trim();
  
  return normalizado;
};

/**
 * Abreviações conhecidas de divisões
 */
const ABREVIACOES_DIVISAO: Record<string, string> = {
  "SJC": "SAO JOSE DOS CAMPOS",
  "SJ DOS CAMPOS": "SAO JOSE DOS CAMPOS",
  "S J CAMPOS": "SAO JOSE DOS CAMPOS",
  "SJCAMPOS": "SAO JOSE DOS CAMPOS",
};

/**
 * Normaliza nome de Divisão para comparação
 * Exemplos:
 * - "Divisao Sao Jose dos Campos Extremo Sul - SP" → "SAO JOSE DOS CAMPOS EXTREMO SUL"
 * - "DIVISAO SAO JOSE DOS CAMPOS EXTREMO SUL - SP" → "SAO JOSE DOS CAMPOS EXTREMO SUL"
 * - "SJC Extremo Sul" → "SAO JOSE DOS CAMPOS EXTREMO SUL"
 */
export const normalizarDivisao = (texto: string): string => {
  if (!texto) return "";
  
  let normalizado = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/^DIVISAO\s*/i, "")      // Remove prefixo "DIVISAO "
    .replace(/(\s*-\s*SP)+$/gi, "")   // Remove MÚLTIPLOS sufixos "- SP"
    .replace(/\s+/g, " ")             // Normaliza espaços
    .trim();

  // Expandir abreviações conhecidas
  Object.entries(ABREVIACOES_DIVISAO).forEach(([abrev, completo]) => {
    const regex = new RegExp(`^${abrev}\\b`, "i");
    normalizado = normalizado.replace(regex, completo);
  });

  return normalizado.trim();
};

/**
 * Dados do período operacional.
 * 
 * NOVA LÓGICA (Relatório CMD - 10 dias):
 *   Período 1 = dia 01 a 10
 *   Período 2 = dia 11 a 20
 *   Período 3 = dia 21 ao último dia do mês
 *
 * Os campos `periodo_inicio` / `periodo_fim` / `ano_referencia` /
 * `mes_referencia` / `semana_no_mes` são reaproveitados:
 *   semana_no_mes = 1 → período 01–10
 *   semana_no_mes = 2 → período 11–20
 *   semana_no_mes = 3 → período 21–fim do mês
 */
export interface SemanaOperacional {
  periodo_inicio: Date;  // Primeiro dia do período
  periodo_fim: Date;     // Último dia do período
  ano_referencia: number;
  mes_referencia: number;
  semana_no_mes: number; // 1, 2 ou 3 (reaproveitado como "período no mês")
}

/**
 * Calcula o período operacional CMD (10 dias) a partir de uma data base.
 *
 * Períodos do mês:
 *   1 → dia 01 a 10
 *   2 → dia 11 a 20
 *   3 → dia 21 ao último dia do mês (28/29/30/31)
 *
 * Retorna:
 * - periodo_inicio: primeiro dia do período (00:00)
 * - periodo_fim: último dia do período (23:59:59.999)
 * - ano_referencia / mes_referencia: do mês corrente da data base
 * - semana_no_mes: 1, 2 ou 3 (reaproveitado como número do período)
 */
export const calcularPeriodoAtual = (dataBase: Date = new Date()): SemanaOperacional => {
  const ref = new Date(dataBase);
  ref.setHours(0, 0, 0, 0);

  const ano = ref.getFullYear();
  const mes = ref.getMonth(); // 0-11
  const dia = ref.getDate();

  // Último dia do mês (dia 0 do mês seguinte)
  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

  let diaInicio: number;
  let diaFim: number;
  let periodoNumero: 1 | 2 | 3;

  if (dia <= 10) {
    diaInicio = 1;
    diaFim = 10;
    periodoNumero = 1;
  } else if (dia <= 20) {
    diaInicio = 11;
    diaFim = 20;
    periodoNumero = 2;
  } else {
    diaInicio = 21;
    diaFim = ultimoDiaMes;
    periodoNumero = 3;
  }

  const periodo_inicio = new Date(ano, mes, diaInicio, 0, 0, 0, 0);
  const periodo_fim = new Date(ano, mes, diaFim, 23, 59, 59, 999);

  return {
    periodo_inicio,
    periodo_fim,
    ano_referencia: ano,
    mes_referencia: mes + 1, // 1-12
    semana_no_mes: periodoNumero,
  };
};

/**
 * Calcula o período operacional anterior ao da data base.
 * Trata corretamente a virada de mês (período 1 → período 3 do mês anterior).
 */
export const calcularPeriodoAnterior = (dataBase: Date = new Date()): SemanaOperacional => {
  const atual = calcularPeriodoAtual(dataBase);

  if (atual.semana_no_mes === 1) {
    // Período anterior = período 3 do mês anterior
    // Pega o dia 25 do mês anterior como referência
    const baseMesAnterior = new Date(atual.ano_referencia, atual.mes_referencia - 2, 25);
    return calcularPeriodoAtual(baseMesAnterior);
  }

  // Períodos 2 ou 3: pegar uma data dentro do período anterior do mesmo mês
  const diaReferencia = atual.semana_no_mes === 2 ? 5 : 15;
  const baseMesmoMes = new Date(atual.ano_referencia, atual.mes_referencia - 1, diaReferencia);
  return calcularPeriodoAtual(baseMesmoMes);
};

/**
 * Retorna label legível do período (ex.: "01–10", "11–20", "21–31").
 */
export const formatarRangePeriodo = (periodo: SemanaOperacional): string => {
  const inicio = String(periodo.periodo_inicio.getDate()).padStart(2, "0");
  const fim = String(periodo.periodo_fim.getDate()).padStart(2, "0");
  return `${inicio}–${fim}`;
};

/**
 * @deprecated Use calcularPeriodoAtual() — mantido apenas como alias para compatibilidade.
 * A lógica antiga de "semana operacional" (Domingo→Sábado) foi substituída pelo
 * sistema de períodos de 10 dias (Relatório CMD). Esta função agora retorna o período atual.
 */
export const calcularSemanaOperacional = (dataBase: Date = new Date()): SemanaOperacional => {
  return calcularPeriodoAtual(dataBase);
};

/**
 * @deprecated Use calcularPeriodoAtual()
 */
export const getSemanaAtual = (): { inicio: Date; fim: Date } => {
  const periodo = calcularPeriodoAtual();
  return { inicio: periodo.periodo_inicio, fim: periodo.periodo_fim };
};

/**
 * Formata data para YYYY-MM-DD
 */
export const formatDateToSQL = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
