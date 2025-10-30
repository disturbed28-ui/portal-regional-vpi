import * as XLSX from 'xlsx';

export interface MensalidadeAtraso {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  ref: string;
  data_vencimento: string;
  valor: number;
  situacao: string;
}

export interface ParseResult {
  mensalidades: MensalidadeAtraso[];
  stats: {
    totalLinhas: number;
    totalValidas: number;
    totalInvalidas: number;
    divisoesEncontradas: string[];
    periodoRef: string;
  };
  erros: string[];
}

// Normalizar ref para formato YYYYMM
export const normalizeRef = (ref: string): string | null => {
  const refStr = String(ref).trim();
  
  // Se já está no formato correto (6 dígitos)
  if (/^\d{6}$/.test(refStr)) {
    return refStr;
  }
  
  // Se tem 4-5 dígitos (ex: 1025 ou 10025), assume ano atual ou adiciona 20 na frente
  if (/^\d{4,5}$/.test(refStr)) {
    const currentYear = new Date().getFullYear();
    // Se for 4 dígitos (MMYY ou YYMM), tentar ambos os formatos
    if (refStr.length === 4) {
      const mesFirst = parseInt(refStr.substring(0, 2));
      if (mesFirst >= 1 && mesFirst <= 12) {
        // Formato MMYY
        const ano = '20' + refStr.substring(2, 4);
        return ano + refStr.substring(0, 2);
      }
    }
    // Se for 5 dígitos, adicionar 0 na frente do mês
    if (refStr.length === 5) {
      return refStr.substring(0, 4) + '0' + refStr.substring(4);
    }
  }
  
  return null;
};

// Validar formato de Ref (AAAAMM - 6 dígitos)
export const isValidRef = (ref: string): boolean => {
  const normalized = normalizeRef(ref);
  if (!normalized) return false;
  
  const ano = parseInt(normalized.substring(0, 4));
  const mes = parseInt(normalized.substring(4, 6));
  
  return ano >= 2020 && ano <= 2099 && mes >= 1 && mes <= 12;
};

// Formatar Ref para display humano (Ex: "Out/2025")
export const formatRef = (ref: string): string => {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mes = parseInt(ref.substring(4, 6)) - 1;
  const ano = ref.substring(0, 4);
  return `${meses[mes]}/${ano}`;
};

export const parseMensalidadesExcel = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        const mensalidades: MensalidadeAtraso[] = [];
        const erros: string[] = [];
        let divisaoAtual = '';
        let registroAtual = 0;
        let nomeAtual = '';

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').trim();

          // Pular cabeçalhos
          if (
            firstCell.includes('Mensalidade') ||
            firstCell.includes('Nome Colete') ||
            firstCell === '' ||
            firstCell.includes('Ref.')
          ) {
            continue;
          }

          // Detectar linha de divisão (começa com "Divisão" ou "Divisao")
          if (firstCell.toLowerCase().startsWith('divisao') || firstCell.toLowerCase().startsWith('divisão')) {
            divisaoAtual = firstCell;
            continue;
          }

          // Detectar linha de total (ignorar)
          if (firstCell.toLowerCase().includes('total')) {
            continue;
          }

          // Detectar linha de integrante (formato: "0229695 Jonão" ou só "Jonão")
          const matchCodigo = firstCell.match(/^(\d{7})\s+(.+)/);
          if (matchCodigo) {
            // Linha com código + nome
            registroAtual = parseInt(matchCodigo[1]);
            nomeAtual = matchCodigo[2].trim();
            
            // Se houver dados de mensalidade na mesma linha
            if (row[1] || row[2]) {
              const refRaw = String(row[1] || '').trim();
              const refNormalized = normalizeRef(refRaw);
              const dataVenc = parseData(row[2]);
              const valor = parseValor(row[3]);
              const situacao = String(row[4] || '').trim();

              if (refNormalized && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref: refNormalized,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
              } else if (refRaw && !refNormalized) {
                erros.push(`Linha ${i + 1}: Ref inválido "${refRaw}" para ${nomeAtual}`);
              }
            }
            continue;
          }

          // Se registroAtual existe e a linha não tem código, é uma mensalidade adicional
          if (registroAtual && row[0] && !firstCell.match(/^\d{7}/)) {
            // Pode ser nome do integrante sem código na próxima linha
            const possibleRef = String(row[0] || '').trim();
            
            // Se o primeiro campo parece ser uma referência (formato: 202510 ou similar)
            if (possibleRef.match(/^\d{4,6}$/)) {
              const refNormalized = normalizeRef(possibleRef);
              const dataVenc = parseData(row[1]);
              const valor = parseValor(row[2]);
              const situacao = String(row[3] || '').trim();

              if (refNormalized && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref: refNormalized,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
              } else if (!refNormalized) {
                erros.push(`Linha ${i + 1}: Ref inválido "${possibleRef}" para ${nomeAtual}`);
              }
            } else {
              // Pode ser só o nome, então os dados estão deslocados
              nomeAtual = firstCell;
              const refRaw = String(row[1] || '').trim();
              const refNormalized = normalizeRef(refRaw);
              const dataVenc = parseData(row[2]);
              const valor = parseValor(row[3]);
              const situacao = String(row[4] || '').trim();

              if (refNormalized && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref: refNormalized,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
              } else if (refRaw && !refNormalized) {
                erros.push(`Linha ${i + 1}: Ref inválido "${refRaw}" para ${nomeAtual}`);
              }
            }
          }
        }

        // Validar
        const validas = mensalidades.filter(
          (m) =>
            m.registro_id > 0 &&
            m.nome_colete &&
            m.divisao_texto &&
            m.ref &&
            isValidRef(m.ref) &&
            m.data_vencimento &&
            m.valor > 0
        );

        // Calcular estatísticas
        const divisoesSet = new Set(validas.map(m => m.divisao_texto));
        const refsCount = new Map<string, number>();
        validas.forEach(m => {
          refsCount.set(m.ref, (refsCount.get(m.ref) || 0) + 1);
        });
        
        // Ref mais comum (período do relatório)
        let refMaisComum = '';
        let maxCount = 0;
        refsCount.forEach((count, ref) => {
          if (count > maxCount) {
            maxCount = count;
            refMaisComum = ref;
          }
        });

        const resultado: ParseResult = {
          mensalidades: validas,
          stats: {
            totalLinhas: jsonData.length,
            totalValidas: validas.length,
            totalInvalidas: mensalidades.length - validas.length,
            divisoesEncontradas: Array.from(divisoesSet),
            periodoRef: refMaisComum ? formatRef(refMaisComum) : '',
          },
          erros
        };

        resolve(resultado);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo Excel de mensalidades: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
};

const parseData = (value: any): string => {
  if (!value) return '';
  
  // Se for número (Excel serial date)
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // Se for Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // Se for string no formato DD/MM/YYYY
  const strValue = String(value).trim();
  const match = strValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  
  return strValue;
};

const parseValor = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  // Remover símbolos de moeda e converter vírgula em ponto
  const strValue = String(value)
    .replace(/[R$\s]/g, '')
    .replace(',', '.');
  
  return parseFloat(strValue) || 0;
};
