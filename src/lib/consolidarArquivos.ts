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
 * Tenta busca exata primeiro, depois normalizada
 */
function findColumnValue(row: any, ...variations: string[]): any {
  // Busca exata primeiro
  for (const variation of variations) {
    if (row[variation] !== undefined && row[variation] !== '') {
      return row[variation];
    }
  }
  
  // Busca normalizada (sem underscores, espaços, case-insensitive)
  const rowKeys = Object.keys(row);
  const normalizedVariations = variations.map(v => normalizeColumnName(v));
  
  for (const key of rowKeys) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedVariations.includes(normalizedKey)) {
      const value = row[key];
      if (value !== undefined && value !== '') {
        return value;
      }
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
 * Colunas esperadas do Arquivo B (dados completos)
 * O Arquivo B é exportado do sistema e contém todas as colunas de dados
 */
const COLUNAS_ARQUIVO_B = [
  'NomeColete', 'Nome_Colete', 'nome_colete',
  'cargo_grau', 'Cargo_Grau', 'CargoGrau',
  'SgtArmas', 'sgt_armas',
  'Caveira', 'caveira',
  'Batedor', 'batedor',
  'Divisão', 'Divisao', 'divisao'
];

/**
 * Parseia Arquivo B (dados completos)
 * Arquivo B tem formato tabular com cabeçalho na primeira linha
 * 
 * Colunas esperadas: NomeColete, cargo_grau, Estagio, SgtArmas, Caveira, 
 * CaveiraSuplente, Batedor, Ursinho, Lobo, TemMoto, TemCarro, Comando, Regional, Divisão
 */
async function parseArquivoB(file: File): Promise<{ registros: any[]; colunas: string[]; valido: boolean; erroValidacao?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Converter para JSON com cabeçalho automático
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
          defval: '',  // Valor padrão para células vazias
          raw: false   // Converter números para string
        });
        
        const colunas = jsonData.length > 0 ? Object.keys(jsonData[0] as any) : [];
        
        console.log('[parseArquivoB] Nome do arquivo:', file.name);
        console.log('[parseArquivoB] Total registros:', jsonData.length);
        console.log('[parseArquivoB] Colunas detectadas:', colunas);
        
        // DEBUG: Mostrar primeira linha para verificar dados
        if (jsonData.length > 0) {
          console.log('[parseArquivoB] Primeira linha (amostra):', jsonData[0]);
        }
        
        // Validar se o arquivo parece ser o Arquivo B (tem colunas esperadas)
        const temColunasB = colunas.some(col => 
          COLUNAS_ARQUIVO_B.some(esperada => 
            normalizeColumnName(col) === normalizeColumnName(esperada)
          )
        );
        
        // Verificar se parece mais com Arquivo A (hierárquico)
        const pareceArquivoA = colunas.length <= 3 || 
          colunas.some(col => col.toLowerCase().includes('hierarquia')) ||
          (jsonData.length > 0 && typeof (jsonData[0] as any)[colunas[0]] === 'string' && 
           (jsonData[0] as any)[colunas[0]].includes('REGIONAL'));
        
        if (!temColunasB || pareceArquivoA) {
          console.warn('[parseArquivoB] AVISO: Arquivo pode não ser o Arquivo B correto!');
          console.warn('[parseArquivoB] Colunas esperadas incluem: NomeColete, cargo_grau, SgtArmas, Divisão');
          console.warn('[parseArquivoB] Colunas recebidas:', colunas);
          
          resolve({
            registros: jsonData as any[],
            colunas,
            valido: false,
            erroValidacao: `Arquivo B inválido. Colunas esperadas: NomeColete, cargo_grau, Divisão. Colunas recebidas: ${colunas.join(', ')}`
          });
          return;
        }
        
        resolve({
          registros: jsonData as any[],
          colunas,
          valido: true
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
  console.log('[consolidarArquivos] ========================================');
  console.log('[consolidarArquivos] Iniciando consolidação...');
  console.log('[consolidarArquivos] Arquivo A:', arquivoA.name, `(${(arquivoA.size / 1024).toFixed(1)} KB)`);
  console.log('[consolidarArquivos] Arquivo B:', arquivoB.name, `(${(arquivoB.size / 1024).toFixed(1)} KB)`);
  
  // 1. Parsear Arquivo A (hierarquia com IDs)
  const resultadoA = await parseArquivoA(arquivoA);
  console.log('[consolidarArquivos] Arquivo A parseado:', resultadoA.estatisticas);
  console.log('[consolidarArquivos] Dicionário criado com', resultadoA.dicionario.size, 'entradas');
  
  // DEBUG: Mostrar algumas chaves do dicionário
  const chavesExemplo = Array.from(resultadoA.dicionario.keys()).slice(0, 3);
  console.log('[consolidarArquivos] Exemplos de chaves no dicionário:', chavesExemplo);
  
  // 2. Parsear Arquivo B (dados completos)
  const resultadoB = await parseArquivoB(arquivoB);
  console.log('[consolidarArquivos] Arquivo B parseado:', resultadoB.registros.length, 'registros');
  console.log('[consolidarArquivos] Arquivo B válido:', resultadoB.valido);
  
  if (!resultadoB.valido) {
    console.error('[consolidarArquivos] ERRO: Arquivo B não é válido!');
    console.error('[consolidarArquivos]', resultadoB.erroValidacao);
    throw new Error(resultadoB.erroValidacao || 'Arquivo B inválido');
  }
  
  // >>> CORREÇÃO VBA: Regional PADRÃO vem do Arquivo A <<<
  // A macro VBA extrai a regional do Arquivo A (hierarquia) e usa como padrão
  const regionalPadrao = resultadoA.estatisticas.regionais[0] || '';
  console.log('[consolidarArquivos] Regional padrão do Arquivo A:', regionalPadrao);
  
  // 3. Consolidar
  const registros: RegistroConsolidado[] = [];
  const naoEncontrados: NaoEncontrado[] = [];
  const regionaisSet = new Set<string>();
  
  // Adicionar regional do Arquivo A às estatísticas
  if (regionalPadrao) {
    regionaisSet.add(regionalPadrao);
  }
  
  for (let i = 0; i < resultadoB.registros.length; i++) {
    const row = resultadoB.registros[i];
    
    // DEBUG: Mostrar primeiras linhas para verificar extração
    if (i < 3) {
      console.log(`[consolidarArquivos] Linha ${i + 1} - Raw:`, row);
    }
    
    // Extrair campos do Arquivo B (múltiplas variações de nomes de colunas)
    const comando = findColumnValue(row, 'Comando', 'comando', 'COMANDO') || '';
    const regionalArquivoB = findColumnValue(row, 'Regional', 'regional', 'REGIONAL') || '';
    const divisaoArquivoB = findColumnValue(row, 'Divisão', 'Divisao', 'divisao', 'DIVISAO') || '';
    const nomeColete = findColumnValue(row, 'NomeColete', 'Nome_Colete', 'nome_colete', 'Nome Colete', 'Nome', 'nome') || '';
    
    // Cargo pode vir como "cargo_grau" ou "Cargo"
    const cargoGrau = findColumnValue(row, 'cargo_grau', 'Cargo_Grau', 'CargoGrau', 'Cargo', 'cargo', 'CARGO') || '';
    
    // Estágio pode vir como "Estagio" ou "CargoEstagio"
    const cargoEstagio = findColumnValue(row, 'Estagio', 'estagio', 'cargo_estagio', 'Cargo_Estagio', 'CargoEstagio') || '';
    
    // DEBUG: Mostrar valores extraídos das primeiras linhas
    if (i < 3) {
      console.log(`[consolidarArquivos] Linha ${i + 1} - Extraído:`, {
        nomeColete, divisaoArquivoB, regionalArquivoB, cargoGrau
      });
    }
    
    // Pular linhas sem nome (podem ser cabeçalhos ou linhas vazias)
    if (!nomeColete || nomeColete.toLowerCase() === 'nomecolete' || nomeColete.toLowerCase() === 'nome_colete') {
      console.log(`[consolidarArquivos] Linha ${i + 1} ignorada (sem nome ou é cabeçalho)`);
      continue;
    }
    
    // 4. Buscar no dicionário do Arquivo A pelo nome + divisão
    const encontrado = buscarNoDicionario(resultadoA.dicionario, nomeColete, divisaoArquivoB);
    
    // DEBUG: Mostrar resultado da busca para primeiras linhas
    if (i < 3) {
      console.log(`[consolidarArquivos] Linha ${i + 1} - Busca no dicionário:`, encontrado ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
    }
    
    // >>> CORREÇÃO VBA: Regional usa Arquivo B OU fallback do Arquivo A <<<
    // A macro VBA prioriza a regional já existente, senão usa a do Arquivo A
    const regionalFinal = String(regionalArquivoB || regionalPadrao).trim();
    
    // >>> CORREÇÃO VBA: Divisão usa a COMPLETA do Arquivo A se encontrou <<<
    // A macro VBA sobrescreve a divisão do Arquivo B pela completa do Arquivo A
    const divisaoFinal = encontrado?.divisaoCompleta 
      ? String(encontrado.divisaoCompleta).trim() 
      : String(divisaoArquivoB).trim();
    
    if (regionalFinal) {
      regionaisSet.add(regionalFinal);
    }
    
    // 5. Verificar se Arquivo B já tem id_integrante e data_entrada (arquivo já processado/COMPLETO)
    // Isso acontece quando o usuário usa um arquivo que já foi consolidado anteriormente
    const idArquivoB = findColumnValue(row, 'id_integrante', 'Id_Integrante', 'ID_Integrante', 'ID');
    const dataArquivoB = findColumnValue(row, 'data_entrada', 'Data_Entrada', 'DataEntrada');
    
    // Determinar ID final: prioriza Arquivo A, mas usa B se existir
    const idFinal = encontrado?.id || (idArquivoB ? parseInt(String(idArquivoB)) : 0);
    
    // Determinar data final: prioriza Arquivo A, mas usa B se existir
    const dataFinal = encontrado?.data || dataArquivoB || undefined;
    
    // 6. Montar registro consolidado
    const registro: RegistroConsolidado = {
      comando: String(comando).trim(),
      regional: regionalFinal,  // Usa fallback do Arquivo A
      divisao: divisaoFinal,    // Usa divisão completa do Arquivo A
      id_integrante: idFinal,
      nome_colete: String(nomeColete).trim(),
      cargo_grau: String(cargoGrau).trim(),
      cargo_estagio: cargoEstagio ? String(cargoEstagio).trim() : undefined,
      data_entrada: dataFinal,
      sgt_armas: converterBool(findColumnValue(row, 'SgtArmas', 'sgt_armas', 'Sgt_Armas')),
      caveira: converterBool(findColumnValue(row, 'Caveira', 'caveira')),
      caveira_suplente: converterBool(findColumnValue(row, 'CaveiraSuplente', 'caveira_suplente', 'Caveira_Suplente')),
      batedor: converterBool(findColumnValue(row, 'Batedor', 'batedor')),
      ursinho: converterBool(findColumnValue(row, 'Ursinho', 'ursinho')),
      lobo: converterBool(findColumnValue(row, 'Lobo', 'lobo')),
      tem_moto: converterBool(findColumnValue(row, 'TemMoto', 'tem_moto', 'Tem_Moto')),
      tem_carro: converterBool(findColumnValue(row, 'TemCarro', 'tem_carro', 'Tem_Carro')),
      encontrado: !!encontrado || !!idArquivoB,  // Considera encontrado se tem ID do B
      origem_id: encontrado ? 'arquivo_a' : (idArquivoB ? 'arquivo_a' : 'nao_encontrado')
    };
    
    registros.push(registro);
    
    // Registrar não encontrados
    if (!encontrado) {
      naoEncontrados.push({
        nome_colete: String(nomeColete).trim(),
        divisao: String(divisaoArquivoB).trim(),
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
