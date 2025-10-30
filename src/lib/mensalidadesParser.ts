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

export const parseMensalidadesExcel = async (file: File): Promise<MensalidadeAtraso[]> => {
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
              const ref = String(row[1] || '').trim();
              const dataVenc = parseData(row[2]);
              const valor = parseValor(row[3]);
              const situacao = String(row[4] || '').trim();

              if (ref && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
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
              const ref = possibleRef;
              const dataVenc = parseData(row[1]);
              const valor = parseValor(row[2]);
              const situacao = String(row[3] || '').trim();

              if (ref && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
              }
            } else {
              // Pode ser só o nome, então os dados estão deslocados
              nomeAtual = firstCell;
              const ref = String(row[1] || '').trim();
              const dataVenc = parseData(row[2]);
              const valor = parseValor(row[3]);
              const situacao = String(row[4] || '').trim();

              if (ref && dataVenc && valor > 0) {
                mensalidades.push({
                  registro_id: registroAtual,
                  nome_colete: nomeAtual,
                  divisao_texto: divisaoAtual,
                  ref,
                  data_vencimento: dataVenc,
                  valor,
                  situacao,
                });
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
            m.data_vencimento &&
            m.valor > 0
        );

        resolve(validas);
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
