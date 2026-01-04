import * as XLSX from 'xlsx';
import { normalizarTexto, normalizarDivisaoTexto } from '@/lib/normalizarTextoHierarquia';

export interface AniversarianteImport {
  nome_colete: string;
  nome_colete_normalizado: string;
  divisao_texto: string;
  divisao_normalizada: string;
  data_nascimento: string; // YYYY-MM-DD
}

export interface AniversariantesParseResult {
  aniversariantes: AniversarianteImport[];
  stats: {
    totalLinhas: number;
    validos: number;
    invalidos: number;
    divisoesEncontradas: string[];
  };
  erros: string[];
}

/**
 * Encontra o índice de uma coluna pelo nome (case-insensitive e com variações)
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h => 
    String(h || '').toLowerCase().trim().replace(/[_\s\/]+/g, '')
  );
  
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim().replace(/[_\s]+/g, '');
    const index = normalizedHeaders.findIndex(h => h.includes(normalizedName) || normalizedName.includes(h));
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Converte uma data do Excel para string YYYY-MM-DD
 */
function parseDataNascimento(value: any): string | null {
  if (!value) return null;
  
  // Se for número (serial date do Excel)
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const year = date.y;
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      return null;
    }
  }
  
  // Se for string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Formato DD/MM/AAAA
    const matchFull = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchFull) {
      const day = String(parseInt(matchFull[1])).padStart(2, '0');
      const month = String(parseInt(matchFull[2])).padStart(2, '0');
      const year = matchFull[3];
      return `${year}-${month}-${day}`;
    }
    
    // Formato DD/MM (assume ano atual ou próximo aniversário)
    const matchShort = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (matchShort) {
      const day = String(parseInt(matchShort[1])).padStart(2, '0');
      const month = String(parseInt(matchShort[2])).padStart(2, '0');
      // Usa ano 1900 como placeholder - o importante é dia/mês
      return `1900-${month}-${day}`;
    }
    
    // Formato AAAA-MM-DD (ISO)
    const matchISO = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchISO) {
      return trimmed;
    }
  }
  
  return null;
}

/**
 * Faz o parse do arquivo Excel de aniversariantes
 */
export function parseAniversariantesExcel(file: File): Promise<AniversariantesParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          defval: ''  // Preservar colunas vazias
        }) as any[][];
        
        if (jsonData.length < 2) {
          resolve({
            aniversariantes: [],
            stats: { totalLinhas: 0, validos: 0, invalidos: 0, divisoesEncontradas: [] },
            erros: ['Arquivo vazio ou sem dados']
          });
          return;
        }
        
        // Detectar linha de cabeçalho dinamicamente (pode não estar na linha 1)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
          if (rowStr.includes('nome') && (rowStr.includes('colete') || rowStr.includes('divisao') || rowStr.includes('divisão'))) {
            headerRowIndex = i;
            break;
          }
        }
        
        console.log('[aniversariantesParser] Header row index:', headerRowIndex);
        console.log('[aniversariantesParser] Headers raw:', jsonData[headerRowIndex]);
        
        // Encontrar colunas
        const headers = jsonData[headerRowIndex].map(h => String(h || ''));
        const nomeColeteIdx = findColumnIndex(headers, ['nome', 'colete', 'nomecolete', 'nome_colete', 'integrante']);
        const divisaoIdx = findColumnIndex(headers, ['divisao', 'divisão', 'div', 'regional/divisao', 'regional_divisao', 'regionaldivisao']);
        const dataNascIdx = findColumnIndex(headers, ['nascimento', 'aniversario', 'aniversário', 'data', 'datanascimento', 'data_nascimento', 'dia/mes', 'dia_mes', 'diames', 'dia']);
        
        console.log('[aniversariantesParser] Índices mapeados:', {
          nomeColeteIdx,
          dataNascIdx,
          divisaoIdx,
          headersWithIndex: headers.map((h, i) => `[${i}]="${h}"`)
        });
        
        // Log das primeiras linhas de dados para verificar estrutura
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 4, jsonData.length); i++) {
          console.log(`[aniversariantesParser] Linha ${i} dados:`, jsonData[i]);
        }
        
        const erros: string[] = [];
        
        if (nomeColeteIdx === -1) {
          erros.push('Coluna "Nome" ou "Colete" não encontrada');
        }
        if (divisaoIdx === -1) {
          erros.push('Coluna "Divisão" não encontrada');
        }
        if (dataNascIdx === -1) {
          erros.push('Coluna "Data de Nascimento" ou "Aniversário" não encontrada');
        }
        
        if (erros.length > 0) {
          resolve({
            aniversariantes: [],
            stats: { totalLinhas: jsonData.length - 1, validos: 0, invalidos: jsonData.length - 1, divisoesEncontradas: [] },
            erros
          });
          return;
        }
        
        const aniversariantes: AniversarianteImport[] = [];
        const divisoesSet = new Set<string>();
        let invalidos = 0;
        
        // Processar linhas (pular até após o header)
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          const nomeColete = String(row[nomeColeteIdx] || '').trim();
          const divisaoTexto = String(row[divisaoIdx] || '').trim();
          const dataNascValue = row[dataNascIdx];
          
          // Validar campos obrigatórios
          if (!nomeColete || !divisaoTexto) {
            invalidos++;
            console.log(`[aniversariantesParser] Linha ${i + 1} inválida:`, {
              nomeColete,
              divisaoTexto,
              nomeColeteIdx,
              divisaoIdx,
              rowLength: row.length,
              row: row.slice(0, 5)
            });
            erros.push(`Linha ${i + 1}: Nome ou Divisão em branco`);
            continue;
          }
          
          const dataNascimento = parseDataNascimento(dataNascValue);
          if (!dataNascimento) {
            invalidos++;
            erros.push(`Linha ${i + 1}: Data de nascimento inválida`);
            continue;
          }
          
          // Normalizar textos usando funções existentes
          const nomeColeteNormalizado = normalizarTexto(nomeColete);
          const divisaoNormalizada = normalizarDivisaoTexto(divisaoTexto);
          
          divisoesSet.add(divisaoTexto);
          
          aniversariantes.push({
            nome_colete: nomeColete,
            nome_colete_normalizado: nomeColeteNormalizado,
            divisao_texto: divisaoTexto,
            divisao_normalizada: divisaoNormalizada,
            data_nascimento: dataNascimento
          });
        }
        
        resolve({
          aniversariantes,
          stats: {
            totalLinhas: jsonData.length - 1,
            validos: aniversariantes.length,
            invalidos,
            divisoesEncontradas: Array.from(divisoesSet)
          },
          erros: erros.slice(0, 10) // Limitar erros exibidos
        });
        
      } catch (error) {
        reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
