import * as XLSX from 'xlsx';
import { parseArquivoA, buscarNoDicionario, normalizarDivisaoParaBusca, ParseArquivoAResult } from './parseArquivoA';
import { ExcelIntegrante } from './excelParser';

/**
 * Interface para resultado de um registro consolidado
 */
export interface RegistroConsolidado extends ExcelIntegrante {
  encontrado: boolean;
  origem_id: 'arquivo_a' | 'nao_encontrado';
}

/**
 * Interface para registro não encontrado
 */
export interface NaoEncontrado {
  nome_colete: string;
  divisao: string;
  cargo_grau: string;
  linha_original: number;
}

/**
 * Interface para o resultado da consolidação
 */
export interface ConsolidacaoResult {
  registros: RegistroConsolidado[];
  naoEncontrados: NaoEncontrado[];
  estatisticas: {
    totalArquivoA: number;
    totalArquivoB: number;
    encontrados: number;
    naoEncontrados: number;
    regionais: string[];
  };
  loteId: string;
  timestamp: Date;
}

/**
 * Normaliza nome de coluna para busca flexível
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\s-]/g, '')
    .trim();
}

/**
 * Busca valor em objeto com variações de nome de coluna
 */
function findColumnValue(row: any, ...variations: string[]): any {
  // Busca exata primeiro
  for (const variation of variations) {
    if (row[variation] !== undefined) {
      return row[variation];
    }
  }
  
  // Busca normalizada
  const rowKeys = Object.keys(row);
  const normalizedVariations = variations.map(v => normalizeColumnName(v));
  
  for (const key of rowKeys) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedVariations.includes(normalizedKey)) {
      return row[key];
    }
  }
  
  return undefined;
}

/**
 * Converte valor S/N para boolean
 */
function converterBool(value: any): boolean {
  return value === 'S' || value === 's' || value === true || value === 'SIM' || value === 'sim';
}

/**
 * Gera ID único do lote
 * Formato: VP1-YYYY-MM-DD-HHMMSS
 */
export function gerarLoteId(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  const hora = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seg = String(now.getSeconds()).padStart(2, '0');
  
  return `VP1-${ano}-${mes}-${dia}-${hora}${min}${seg}`;
}

/**
 * Parseia Arquivo B (dados completos sem IDs)
 */
async function parseArquivoB(file: File): Promise<{ registros: any[]; colunas: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const colunas = jsonData.length > 0 ? Object.keys(jsonData[0] as any) : [];
        
        console.log('[parseArquivoB] Total registros:', jsonData.length);
        console.log('[parseArquivoB] Colunas:', colunas);
        
        resolve({
          registros: jsonData as any[],
          colunas
        });
        
      } catch (error) {
        console.error('[parseArquivoB] Erro:', error);
        reject(new Error('Erro ao processar Arquivo B: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler Arquivo B'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Consolida Arquivo A e Arquivo B
 * Replica a lógica da macro VBA CompilaDadosIntegrantes
 */
export async function consolidarArquivos(
  arquivoA: File,
  arquivoB: File
): Promise<ConsolidacaoResult> {
  console.log('[consolidarArquivos] Iniciando consolidação...');
  
  // 1. Parsear Arquivo A (hierarquia com IDs)
  const resultadoA = await parseArquivoA(arquivoA);
  console.log('[consolidarArquivos] Arquivo A parseado:', resultadoA.estatisticas);
  
  // 2. Parsear Arquivo B (dados completos)
  const resultadoB = await parseArquivoB(arquivoB);
  console.log('[consolidarArquivos] Arquivo B parseado:', resultadoB.registros.length, 'registros');
  
  // 3. Consolidar
  const registros: RegistroConsolidado[] = [];
  const naoEncontrados: NaoEncontrado[] = [];
  const regionaisSet = new Set<string>();
  
  for (let i = 0; i < resultadoB.registros.length; i++) {
    const row = resultadoB.registros[i];
    
    // Extrair campos do Arquivo B
    const comando = findColumnValue(row, 'comando', 'Comando', 'COMANDO') || '';
    const regional = findColumnValue(row, 'regional', 'Regional', 'REGIONAL') || '';
    const divisao = findColumnValue(row, 'divisao', 'Divisao', 'Divisão', 'DIVISAO') || '';
    const nomeColete = findColumnValue(row, 'nome_colete', 'Nome_Colete', 'NomeColete', 'Nome Colete', 'nome', 'Nome') || '';
    
    // Cargo pode vir como "Cargo" ou "cargo_grau" - renomear conforme macro
    const cargoGrau = findColumnValue(row, 'cargo_grau', 'Cargo_Grau', 'CargoGrau', 'cargo', 'Cargo', 'CARGO') || '';
    
    // Estágio pode vir como "CargoEstagio" ou "Estagio"
    const cargoEstagio = findColumnValue(row, 'cargo_estagio', 'Cargo_Estagio', 'CargoEstagio', 'Estagio', 'estagio') || '';
    
    if (regional) {
      regionaisSet.add(regional);
    }
    
    // 4. Buscar no dicionário do Arquivo A
    const encontrado = buscarNoDicionario(resultadoA.dicionario, nomeColete, divisao);
    
    // 5. Montar registro consolidado
    const registro: RegistroConsolidado = {
      comando: String(comando).trim(),
      regional: String(regional).trim(),
      divisao: String(divisao).trim(),
      id_integrante: encontrado?.id || 0,
      nome_colete: String(nomeColete).trim(),
      cargo_grau: String(cargoGrau).trim(),
      cargo_estagio: cargoEstagio ? String(cargoEstagio).trim() : undefined,
      data_entrada: encontrado?.data || undefined,
      sgt_armas: converterBool(findColumnValue(row, 'SgtArmas', 'sgt_armas', 'Sgt_Armas')),
      caveira: converterBool(findColumnValue(row, 'Caveira', 'caveira')),
      caveira_suplente: converterBool(findColumnValue(row, 'CaveiraSuplente', 'caveira_suplente', 'Caveira_Suplente')),
      batedor: converterBool(findColumnValue(row, 'Batedor', 'batedor')),
      ursinho: converterBool(findColumnValue(row, 'Ursinho', 'ursinho')),
      lobo: converterBool(findColumnValue(row, 'Lobo', 'lobo')),
      tem_moto: converterBool(findColumnValue(row, 'TemMoto', 'tem_moto', 'Tem_Moto')),
      tem_carro: converterBool(findColumnValue(row, 'TemCarro', 'tem_carro', 'Tem_Carro')),
      encontrado: !!encontrado,
      origem_id: encontrado ? 'arquivo_a' : 'nao_encontrado'
    };
    
    registros.push(registro);
    
    // Registrar não encontrados
    if (!encontrado) {
      naoEncontrados.push({
        nome_colete: String(nomeColete).trim(),
        divisao: String(divisao).trim(),
        cargo_grau: String(cargoGrau).trim(),
        linha_original: i + 2 // +2 porque i começa em 0 e tem cabeçalho
      });
    }
  }
  
  // 6. Estatísticas
  const estatisticas = {
    totalArquivoA: resultadoA.estatisticas.total,
    totalArquivoB: resultadoB.registros.length,
    encontrados: registros.filter(r => r.encontrado).length,
    naoEncontrados: naoEncontrados.length,
    regionais: Array.from(regionaisSet)
  };
  
  console.log('[consolidarArquivos] Consolidação concluída:', estatisticas);
  
  return {
    registros,
    naoEncontrados,
    estatisticas,
    loteId: gerarLoteId(),
    timestamp: new Date()
  };
}

/**
 * Valida se os arquivos são compatíveis antes da consolidação
 */
export function validarArquivos(arquivoA: File, arquivoB: File): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  
  // Validar extensões
  const extensoesValidas = ['.xls', '.xlsx'];
  const extA = arquivoA.name.substring(arquivoA.name.lastIndexOf('.')).toLowerCase();
  const extB = arquivoB.name.substring(arquivoB.name.lastIndexOf('.')).toLowerCase();
  
  if (!extensoesValidas.includes(extA)) {
    erros.push(`Arquivo A deve ser Excel (.xls ou .xlsx), recebido: ${extA}`);
  }
  
  if (!extensoesValidas.includes(extB)) {
    erros.push(`Arquivo B deve ser Excel (.xls ou .xlsx), recebido: ${extB}`);
  }
  
  // Validar tamanho (máximo 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (arquivoA.size > maxSize) {
    erros.push(`Arquivo A muito grande (máx 10MB)`);
  }
  
  if (arquivoB.size > maxSize) {
    erros.push(`Arquivo B muito grande (máx 10MB)`);
  }
  
  return {
    valido: erros.length === 0,
    erros
  };
}
