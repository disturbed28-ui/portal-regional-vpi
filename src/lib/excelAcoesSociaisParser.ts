import * as XLSX from 'xlsx';

export interface AcaoSocialExcel {
  data_acao: string | number;
  regional: string;
  divisao: string;
  responsavel: string;
  escopo: string;
  tipo_acao: string;
  descricao: string;
  email: string;
}

// Mapeamento de colunas do Excel para campos esperados
const COLUMN_MAPPING: Record<string, keyof AcaoSocialExcel> = {
  'data da ação': 'data_acao',
  'data da acao': 'data_acao',
  'data': 'data_acao',
  'regional': 'regional',
  'divisão': 'divisao',
  'divisao': 'divisao',
  'nome do social responsável': 'responsavel',
  'nome do social responsavel': 'responsavel',
  'social responsável': 'responsavel',
  'social responsavel': 'responsavel',
  'responsável': 'responsavel',
  'responsavel': 'responsavel',
  'nome': 'responsavel',
  'ação interna ou externa?': 'escopo',
  'acao interna ou externa?': 'escopo',
  'ação interna ou externa': 'escopo',
  'acao interna ou externa': 'escopo',
  'escopo': 'escopo',
  'interna/externa': 'escopo',
  'tipo da ação': 'tipo_acao',
  'tipo da acao': 'tipo_acao',
  'tipo de ação': 'tipo_acao',
  'tipo de acao': 'tipo_acao',
  'tipo': 'tipo_acao',
  'descrição da ação': 'descricao',
  'descricao da acao': 'descricao',
  'descrição': 'descricao',
  'descricao': 'descricao',
  'endereço de e-mail': 'email',
  'endereco de e-mail': 'email',
  'endereço de email': 'email',
  'endereco de email': 'email',
  'e-mail': 'email',
  'email': 'email',
};

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapColumns(headers: string[]): Record<number, keyof AcaoSocialExcel> {
  const mapping: Record<number, keyof AcaoSocialExcel> = {};
  
  headers.forEach((header, index) => {
    const normalized = normalizeColumnName(header);
    const mappedField = COLUMN_MAPPING[normalized];
    if (mappedField) {
      mapping[index] = mappedField;
    }
  });
  
  return mapping;
}

export function parseAcoesSociaisExcel(file: File): Promise<AcaoSocialExcel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para array de arrays
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length < 2) {
          reject(new Error('Arquivo vazio ou sem dados suficientes'));
          return;
        }
        
        // Primeira linha são os headers
        const headers = rawData[0].map(String);
        const columnMapping = mapColumns(headers);
        
        // Verificar se mapeou as colunas essenciais
        const mappedFields = Object.values(columnMapping);
        const requiredFields: (keyof AcaoSocialExcel)[] = ['data_acao', 'responsavel', 'email'];
        const missingFields = requiredFields.filter(f => !mappedFields.includes(f));
        
        if (missingFields.length > 0) {
          reject(new Error(`Colunas obrigatórias não encontradas: ${missingFields.join(', ')}`));
          return;
        }
        
        // Mapear linhas para objetos
        const result: AcaoSocialExcel[] = [];
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const registro: Partial<AcaoSocialExcel> = {};
          
          Object.entries(columnMapping).forEach(([indexStr, field]) => {
            const index = parseInt(indexStr);
            const value = row[index];
            registro[field] = value !== undefined ? value : '';
          });
          
          // Pular linhas sem dados essenciais
          if (!registro.email && !registro.responsavel && !registro.data_acao) {
            continue;
          }
          
          result.push({
            data_acao: registro.data_acao || '',
            regional: registro.regional || '',
            divisao: registro.divisao || '',
            responsavel: registro.responsavel || '',
            escopo: registro.escopo || '',
            tipo_acao: registro.tipo_acao || '',
            descricao: registro.descricao || '',
            email: registro.email || '',
          });
        }
        
        console.log(`[excelAcoesSociaisParser] Parsed ${result.length} registros`);
        resolve(result);
        
      } catch (error) {
        console.error('[excelAcoesSociaisParser] Erro ao parsear:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
