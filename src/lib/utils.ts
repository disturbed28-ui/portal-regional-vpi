import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function removeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '');
}

/**
 * Normaliza nomes de divisões removendo acentos, cedilhas e convertendo para maiúsculas
 */
export function normalizarNomeDivisao(nome: string): string {
  return nome
    .normalize('NFD')                          // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')          // Remove marcas diacríticas (acentos)
    .replace(/[çÇ]/g, 'C')                    // Remove cedilhas manualmente
    .toUpperCase()                             // Converte para maiúsculas
    .trim()                                    // Remove espaços extras
    .replace(/\s+/g, ' ');                    // Normaliza múltiplos espaços em um só
}
