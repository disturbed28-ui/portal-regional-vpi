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
 * Dados da semana operacional (Domingo → Sábado)
 */
export interface SemanaOperacional {
  periodo_inicio: Date;  // Domingo
  periodo_fim: Date;     // Sábado
  ano_referencia: number;
  mes_referencia: number;
  semana_no_mes: number;
}

/**
 * Calcula os dados da semana operacional (Domingo → Sábado)
 * A partir de uma data base, retorna:
 * - periodo_inicio: Domingo da semana
 * - periodo_fim: Sábado da semana  
 * - ano_referencia: Ano do sábado
 * - mes_referencia: Mês do sábado (1-12)
 * - semana_no_mes: Posição do sábado entre os sábados do mês (1-5)
 */
export const calcularSemanaOperacional = (dataBase: Date = new Date()): SemanaOperacional => {
  // 1. Normalizar data (sem hora)
  const hoje = new Date(dataBase);
  hoje.setHours(0, 0, 0, 0);
  
  // 2. Dia da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)
  const dow = hoje.getDay();
  
  // 3. Calcular o sábado (periodo_fim) da semana
  const diasAteSabado = (6 - dow + 7) % 7;
  const periodo_fim = new Date(hoje);
  periodo_fim.setDate(hoje.getDate() + diasAteSabado);
  periodo_fim.setHours(23, 59, 59, 999);
  
  // 4. Calcular o domingo (periodo_inicio) = sábado - 6 dias
  const periodo_inicio = new Date(periodo_fim);
  periodo_inicio.setDate(periodo_fim.getDate() - 6);
  periodo_inicio.setHours(0, 0, 0, 0);
  
  // 5. Ano e mês de referência = do sábado
  const ano_referencia = periodo_fim.getFullYear();
  const mes_referencia = periodo_fim.getMonth() + 1; // 1-12
  
  // 6. Calcular semana_no_mes
  // Primeiro dia do mês do sábado
  const primeiroDiaMes = new Date(ano_referencia, mes_referencia - 1, 1);
  const dowPrimeiro = primeiroDiaMes.getDay();
  
  // Primeiro sábado do mês
  const offsetParaSabado = (6 - dowPrimeiro + 7) % 7;
  const primeiroSabadoMes = new Date(primeiroDiaMes);
  primeiroSabadoMes.setDate(1 + offsetParaSabado);
  
  // Diferença em dias entre o primeiro sábado e o sábado atual
  const diffMs = periodo_fim.getTime() - primeiroSabadoMes.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const semana_no_mes = 1 + Math.floor(diffDias / 7);
  
  return {
    periodo_inicio,
    periodo_fim,
    ano_referencia,
    mes_referencia,
    semana_no_mes
  };
};

/**
 * @deprecated Use calcularSemanaOperacional() 
 * Calcula início e fim da semana atual (segunda a domingo)
 */
export const getSemanaAtual = (): { inicio: Date; fim: Date } => {
  const semana = calcularSemanaOperacional();
  return { inicio: semana.periodo_inicio, fim: semana.periodo_fim };
};

/**
 * Formata data para YYYY-MM-DD
 */
export const formatDateToSQL = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
