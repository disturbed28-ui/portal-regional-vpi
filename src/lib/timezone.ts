import { formatInTimeZone } from 'date-fns-tz';

export const TIMEZONE = 'America/Sao_Paulo'; // UTC-3

/**
 * Formata uma data no timezone de Brasília (UTC-3)
 * @param data - Data a ser formatada (Date ou string ISO)
 * @param formato - Formato desejado (padrão: 'dd/MM/yyyy HH:mm')
 * @returns String formatada no timezone de Brasília
 */
export function formatarDataBrasil(
  data: Date | string,
  formato: string = 'dd/MM/yyyy HH:mm'
): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  return formatInTimeZone(dataObj, TIMEZONE, formato);
}

/**
 * Retorna a data/hora atual (o browser já considera o timezone local)
 */
export function dataAtualBrasil(): Date {
  return new Date();
}
