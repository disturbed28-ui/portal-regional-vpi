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
 * Converte data do Excel (serial ou string) para formato YYYY-MM-DD
 * Para datas DD/MM (sem ano), usa 1900 como placeholder
 */
function parseDataNascimento(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Se for número (serial date do Excel)
  if (typeof value === 'number') {
    try {
      // XLSX.SSF.parse_date_code converte serial do Excel para componentes de data
      const date = XLSX.SSF.parse_date_code(value);
      if (date && date.d && date.m) {
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        // Para aniversários, o ano não importa - usamos 1900 como placeholder
        return `1900-${month}-${day}`;
      }
    } catch {
      return null;
    }
  }
  
  // Se for string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    // Formato DD/MM/AAAA ou DD-MM-AAAA
    const matchFull = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchFull) {
      const day = String(parseInt(matchFull[1])).padStart(2, '0');
      const month = String(parseInt(matchFull[2])).padStart(2, '0');
      const year = matchFull[3];
      return `${year}-${month}-${day}`;
    }
    
    // Formato DD/MM ou DD-MM (sem ano)
    const matchShort = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (matchShort) {
      const day = String(parseInt(matchShort[1])).padStart(2, '0');
      const month = String(parseInt(matchShort[2])).padStart(2, '0');
      return `1900-${month}-${day}`;
    }
    
    // Formato AAAA-MM-DD (ISO)
    const matchISO = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchISO) {
      return trimmed;
    }
  }
  
  // Se for objeto Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `1900-${month}-${day}`;
  }
  
  return null;
}

/**
 * Faz o parse do arquivo Excel de aniversariantes
 * 
 * Estrutura esperada do Excel:
 * - Linha 1: Título (ex: "Próximos Aniversariantes (x0268)")
 * - Linha 2: Vazia
 * - Linha 3: Cabeçalhos: "Nome Colete" | "Dia/Mes" | "" | "Regional/Divisao"
 * - Linha 4+: Dados
 */
export function parseAniversariantesExcel(file: File): Promise<AniversariantesParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Usar raw: true para preservar valores originais sem conversão automática
        const workbook = XLSX.read(data, { 
          type: 'array', 
          cellDates: false,
          raw: true
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          defval: '',
          raw: true
        }) as any[][];
        
        console.log('[aniversariantesParser] Total de linhas:', jsonData.length);
        
        if (jsonData.length < 2) {
          resolve({
            aniversariantes: [],
            stats: { totalLinhas: 0, validos: 0, invalidos: 0, divisoesEncontradas: [] },
            erros: ['Arquivo vazio ou sem dados']
          });
          return;
        }
        
        // 1. Encontrar linha de cabeçalho e mapear colunas
        let headerRowIndex = -1;
        let nomeColIdx = -1;
        let dataColIdx = -1;
        let divisaoColIdx = -1;
        
        // Procurar nas primeiras 10 linhas
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;
          
          // Verificar cada célula da linha
          for (let j = 0; j < row.length; j++) {
            const cellValue = String(row[j] || '').toLowerCase().trim();
            
            // Encontrar coluna Nome/Colete
            if (cellValue.includes('nome') || cellValue === 'colete') {
              nomeColIdx = j;
              headerRowIndex = i;
            }
            
            // Encontrar coluna Data (Dia/Mes, Nascimento, Aniversário)
            if (cellValue.includes('dia') || cellValue.includes('nascimento') || 
                cellValue.includes('aniversario') || cellValue.includes('aniversário')) {
              dataColIdx = j;
            }
            
            // Encontrar coluna Divisão/Regional (procurar por "divisao" ou "regional" na mesma célula)
            if ((cellValue.includes('divisao') || cellValue.includes('divisão') || 
                cellValue.includes('regional')) && cellValue !== '') {
              divisaoColIdx = j;
            }
          }
          
          // Se encontrou a linha de header (tem pelo menos nome e divisão mapeados)
          if (headerRowIndex !== -1 && nomeColIdx !== -1) {
            break;
          }
        }
        
        console.log('[aniversariantesParser] Header encontrado na linha:', headerRowIndex);
        console.log('[aniversariantesParser] Headers:', jsonData[headerRowIndex]);
        console.log('[aniversariantesParser] Índices mapeados:', { nomeColIdx, dataColIdx, divisaoColIdx });
        
        // Log das primeiras linhas de dados
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 4, jsonData.length); i++) {
          console.log(`[aniversariantesParser] Linha ${i} dados:`, jsonData[i]);
        }
        
        const erros: string[] = [];
        
        // Validar se encontrou as colunas essenciais
        if (headerRowIndex === -1) {
          erros.push('Não foi possível encontrar a linha de cabeçalho');
        }
        if (nomeColIdx === -1) {
          erros.push('Coluna "Nome" ou "Colete" não encontrada');
        }
        if (divisaoColIdx === -1) {
          erros.push('Coluna "Divisão" ou "Regional/Divisao" não encontrada');
        }
        if (dataColIdx === -1) {
          erros.push('Coluna "Dia/Mes" ou "Data de Nascimento" não encontrada');
        }
        
        if (headerRowIndex === -1 || nomeColIdx === -1 || divisaoColIdx === -1 || dataColIdx === -1) {
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
        
        // 2. Processar linhas de dados (após o header)
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Pular linhas vazias ou muito curtas
          if (!row || row.length < Math.max(nomeColIdx, dataColIdx, divisaoColIdx) + 1) {
            continue;
          }
          
          const nomeColete = String(row[nomeColIdx] || '').trim();
          const divisaoTexto = String(row[divisaoColIdx] || '').trim();
          const dataValue = row[dataColIdx];
          
          // Pular linhas sem dados essenciais
          if (!nomeColete) {
            continue; // Linha completamente vazia ou sem nome
          }
          
          if (!divisaoTexto) {
            invalidos++;
            if (erros.length < 10) {
              erros.push(`Linha ${i + 1}: Divisão em branco para "${nomeColete}"`);
            }
            continue;
          }
          
          // Parsear data
          const dataNascimento = parseDataNascimento(dataValue);
          if (!dataNascimento) {
            invalidos++;
            if (erros.length < 10) {
              erros.push(`Linha ${i + 1}: Data inválida para "${nomeColete}" (valor: ${dataValue})`);
            }
            continue;
          }
          
          // Normalizar textos
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
        
        console.log('[aniversariantesParser] Resultado:', {
          validos: aniversariantes.length,
          invalidos,
          divisoes: Array.from(divisoesSet).slice(0, 5)
        });
        
        resolve({
          aniversariantes,
          stats: {
            totalLinhas: jsonData.length - headerRowIndex - 1,
            validos: aniversariantes.length,
            invalidos,
            divisoesEncontradas: Array.from(divisoesSet)
          },
          erros
        });
        
      } catch (error) {
        console.error('[aniversariantesParser] Erro:', error);
        reject(new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
