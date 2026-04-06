import * as XLSX from 'xlsx';

export interface AfastadoExcel {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  cargo_grau_texto: string | null;
  tipo_afastamento: string;
  data_afastamento: string; // ISO format YYYY-MM-DD
  data_retorno_prevista: string; // ISO format YYYY-MM-DD
  suspenso?: boolean; // true when dates were auto-generated (suspension)
  dias_suspensao?: number; // default 30, editable by user
  observacao_auto?: string; // auto-generated observation
}

export interface ParseAfastadosResult {
  afastados: AfastadoExcel[];
  erros: string[];
  estatisticas: {
    total: number;
    porDivisao: Record<string, number>;
    retornosProximos: number; // próximos 30 dias
  };
}

// Converter data DD/MM/YYYY para YYYY-MM-DD
function convertDateFormat(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  
  const dateString = String(dateStr).trim();
  
  // Se já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Formato DD/MM/YYYY
  const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

// Validar se data é válida
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

export async function parseAfastadosExcel(file: File): Promise<ParseAfastadosResult> {
  const erros: string[] = [];
  const afastados: AfastadoExcel[] = [];
  const porDivisao: Record<string, number> = {};

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    let divisaoAtual = '';
    let headerRow: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Pular linhas vazias
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue;
      }

      const firstCell = String(row[0] || '').trim();

      // Detectar linha de divisão
      if (firstCell.toLowerCase().includes('divisão')) {
        divisaoAtual = firstCell.replace(/^divisão\s*/i, '').trim();
        continue;
      }

      // Detectar linha de cabeçalho
      if (firstCell.toLowerCase() === 'numero' || firstCell.toLowerCase() === 'número') {
        headerRow = row.map(cell => String(cell || '').trim().toLowerCase());
        continue;
      }

      // Linha de dados
      if (headerRow.length > 0 && divisaoAtual) {
        const rowData: any = {};
        headerRow.forEach((header, idx) => {
          rowData[header] = row[idx];
        });

        // Mapear colunas
        const registro_id = parseInt(String(rowData['numero'] || rowData['número'] || ''));
        const nome_colete = String(rowData['apelido'] || '').trim();
        const cargo_grau_texto = rowData['cargo/funcao'] || rowData['cargo/função'] || null;
        const tipo_afastamento = String(rowData['tipo afastamento'] || 'Afastado').trim();
        const dt_afastamento = rowData['dt. afast.'] || rowData['dt afast'] || rowData['data afastamento'];
        const dt_retorno = rowData['dt. retorno'] || rowData['dt retorno'] || rowData['data retorno'];

        // Validações
        if (!registro_id || isNaN(registro_id)) {
          erros.push(`Linha ${i + 1}: Número do registro inválido`);
          continue;
        }

        if (!nome_colete) {
          erros.push(`Linha ${i + 1}: Apelido não informado`);
          continue;
        }

        const data_afastamento = convertDateFormat(dt_afastamento);
        const data_retorno_prevista = convertDateFormat(dt_retorno);

        // Se não tem data de afastamento ou retorno, tratar como suspenso (default 30 dias)
        const isSuspenso = !data_afastamento || !isValidDate(data_afastamento || '') || !data_retorno_prevista || !isValidDate(data_retorno_prevista || '');

        let finalDataAfastamento = data_afastamento;
        let finalDataRetorno = data_retorno_prevista;
        const diasSuspensaoPadrao = 30;

        if (isSuspenso) {
          const hoje = new Date();
          finalDataAfastamento = hoje.toISOString().split('T')[0];
          const retorno = new Date(hoje);
          retorno.setDate(retorno.getDate() + diasSuspensaoPadrao);
          finalDataRetorno = retorno.toISOString().split('T')[0];
        } else {
          // Validar que data_afastamento < data_retorno_prevista
          if (new Date(finalDataAfastamento!) >= new Date(finalDataRetorno!)) {
            erros.push(`Linha ${i + 1} (${nome_colete}): Data de afastamento deve ser anterior à data de retorno`);
            continue;
          }
        }

        afastados.push({
          registro_id,
          nome_colete,
          divisao_texto: divisaoAtual,
          cargo_grau_texto: cargo_grau_texto ? String(cargo_grau_texto).trim() : null,
          tipo_afastamento: isSuspenso ? 'Suspenso' : tipo_afastamento,
          data_afastamento: finalDataAfastamento!,
          data_retorno_prevista: finalDataRetorno!,
          suspenso: isSuspenso,
          dias_suspensao: isSuspenso ? diasSuspensaoPadrao : undefined,
          observacao_auto: isSuspenso ? `${nome_colete} está suspenso (sem datas no arquivo original)` : undefined,
        });

        // Contar por divisão
        porDivisao[divisaoAtual] = (porDivisao[divisaoAtual] || 0) + 1;
      }
    }

    // Calcular retornos próximos (30 dias)
    const hoje = new Date();
    const em30Dias = new Date(hoje);
    em30Dias.setDate(em30Dias.getDate() + 30);

    const retornosProximos = afastados.filter(a => {
      const dataRetorno = new Date(a.data_retorno_prevista);
      return dataRetorno >= hoje && dataRetorno <= em30Dias;
    }).length;

    return {
      afastados,
      erros,
      estatisticas: {
        total: afastados.length,
        porDivisao,
        retornosProximos,
      },
    };
  } catch (error) {
    console.error('Erro ao parsear Excel de afastados:', error);
    throw new Error('Erro ao processar arquivo Excel. Verifique o formato.');
  }
}
