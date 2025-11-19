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
 * Calcula início e fim da semana atual (segunda a domingo)
 */
export const getSemanaAtual = (): { inicio: Date; fim: Date } => {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda
  
  // Calcular segunda-feira
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  segunda.setHours(0, 0, 0, 0);
  
  // Calcular domingo
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);
  
  return { inicio: segunda, fim: domingo };
};

/**
 * Formata data para YYYY-MM-DD
 */
export const formatDateToSQL = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
