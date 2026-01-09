import * as XLSX from 'xlsx';

/**
 * Interface para dados do Arquivo A (hierarquia)
 */
export interface ArquivoAIntegrante {
  id_integrante: number;
  nome_colete: string;
  data_admissao: string | null;
  divisao_original: string;
  regional_original: string;
}

/**
 * Interface para o resultado do parse do Arquivo A
 */
export interface ParseArquivoAResult {
  integrantes: ArquivoAIntegrante[];
  dicionario: Map<string, { id: number; data: string | null; divisaoCompleta: string }>;
  estatisticas: {
    total: number;
    regionais: string[];
    divisoes: string[];
  };
}

/**
 * Remove acentos de um texto
 */
function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza nome do integrante (limpa e padroniza)
 * Replica LimpaNome da macro VBA
 */
function limparNome(nome: string | null | undefined): string {
  if (!nome) return '';
  return nome
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza divisão para criar chave de busca
 * Replica NormalizaDivisao da macro VBA
 */
export function normalizarDivisaoParaBusca(divisao: string): string {
  if (!divisao) return '';
  
  let normalizado = removerAcentos(divisao)
    .toUpperCase()
    .trim();
  
  // Remover prefixos
  normalizado = normalizado
    .replace(/^DIVISAO\s*/i, '')
    .replace(/^REGIONAL\s*/i, '');
  
  // Remover sufixos de estado
  normalizado = normalizado
    .replace(/\s*-\s*SP\s*$/i, '')
    .replace(/\s*-SP\s*$/i, '')
    .replace(/\s*SP\s*$/i, '');
  
  // Padronizar espaços
  normalizado = normalizado.replace(/\s+/g, ' ').trim();
  
  // Adicionar sufixo padronizado
  normalizado = normalizado + ' - SP';
  
  return normalizado;
}

/**
 * Cria chave única para busca no dicionário
 */
function criarChaveBusca(nome: string, divisao: string): string {
  const nomeNormalizado = limparNome(nome);
  const divisaoNormalizada = normalizarDivisaoParaBusca(divisao);
  return `${nomeNormalizado}|${divisaoNormalizada}`;
}

/**
 * Formata data para padrão ISO (YYYY-MM-DD)
 */
function formatarData(valor: any): string | null {
  if (!valor) return null;
  
  // Se for número (serial date do Excel)
  if (typeof valor === 'number') {
    const date = new Date((valor - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }
  
  // Se for Date
  if (valor instanceof Date) {
    if (!isNaN(valor.getTime())) {
      return valor.toISOString().split('T')[0];
    }
    return null;
  }
  
  // Se for string
  const texto = String(valor).trim();
  if (!texto) return null;
  
  // Formato DD/MM/YYYY
  const matchBR = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBR) {
    return `${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`;
  }
  
  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }
  
  return null;
}

/**
 * Parseia Arquivo A (formato hierárquico)
 * 
 * Estrutura esperada:
 * - Linhas com "REGIONAL" indicam uma nova regional
 * - Linhas não-numéricas na primeira coluna indicam divisões
 * - Linhas com número na primeira coluna são integrantes
 */
export async function parseArquivoA(file: File): Promise<ParseArquivoAResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Converter para array de arrays (mantém estrutura original)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        console.log('[parseArquivoA] Total de linhas:', jsonData.length);
        
        const integrantes: ArquivoAIntegrante[] = [];
        const dicionario = new Map<string, { id: number; data: string | null; divisaoCompleta: string }>();
        const regionaisSet = new Set<string>();
        const divisoesSet = new Set<string>();
        
        let regionalAtual = '';
        let divisaoAtual = '';
        
        for (let i = 0; i < jsonData.length; i++) {
          const linha = jsonData[i];
          if (!linha || linha.length === 0) continue;
          
          const primeiraColuna = String(linha[0] || '').trim();
          
          // Detectar regional (linha contém "REGIONAL")
          if (primeiraColuna.toUpperCase().includes('REGIONAL')) {
            regionalAtual = primeiraColuna;
            regionaisSet.add(regionalAtual);
            console.log(`[parseArquivoA] Regional detectada: ${regionalAtual}`);
            continue;
          }
          
          // Detectar se é uma linha de integrante (primeira coluna é número)
          const numeroId = parseInt(primeiraColuna);
          if (!isNaN(numeroId) && numeroId > 0) {
            // É uma linha de integrante
            // Estrutura típica: ID | Nome | Data
            const nome = String(linha[1] || '').trim();
            const dataAdmissao = formatarData(linha[2]);
            
            if (nome) {
              const integrante: ArquivoAIntegrante = {
                id_integrante: numeroId,
                nome_colete: nome,
                data_admissao: dataAdmissao,
                divisao_original: divisaoAtual,
                regional_original: regionalAtual
              };
              
              integrantes.push(integrante);
              
              // Adicionar ao dicionário
              const chave = criarChaveBusca(nome, divisaoAtual);
              dicionario.set(chave, {
                id: numeroId,
                data: dataAdmissao,
                divisaoCompleta: divisaoAtual
              });
            }
          } else if (primeiraColuna && !primeiraColuna.toUpperCase().startsWith('ID') && primeiraColuna.length > 2) {
            // É uma linha de divisão (não é cabeçalho "ID" e tem conteúdo significativo)
            // Verificar se parece um nome de divisão
            const semNumeros = !/^\d+$/.test(primeiraColuna);
            if (semNumeros) {
              divisaoAtual = primeiraColuna;
              divisoesSet.add(divisaoAtual);
              console.log(`[parseArquivoA] Divisão detectada: ${divisaoAtual}`);
            }
          }
        }
        
        console.log('[parseArquivoA] Resumo:', {
          integrantes: integrantes.length,
          regionais: regionaisSet.size,
          divisoes: divisoesSet.size
        });
        
        resolve({
          integrantes,
          dicionario,
          estatisticas: {
            total: integrantes.length,
            regionais: Array.from(regionaisSet),
            divisoes: Array.from(divisoesSet)
          }
        });
        
      } catch (error) {
        console.error('[parseArquivoA] Erro:', error);
        reject(new Error('Erro ao processar Arquivo A: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler Arquivo A'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Busca integrante no dicionário usando nome e divisão
 */
export function buscarNoDicionario(
  dicionario: Map<string, { id: number; data: string | null; divisaoCompleta: string }>,
  nome: string,
  divisao: string
): { id: number; data: string | null; divisaoCompleta: string } | null {
  const chave = criarChaveBusca(nome, divisao);
  return dicionario.get(chave) || null;
}
