import * as XLSX from 'xlsx';
import { IntegrantePortal } from '@/hooks/useIntegrantes';

export interface ExcelIntegrante {
  comando: string;
  regional: string;
  divisao: string;
  id_integrante: number;
  nome_colete: string;
  cargo_grau: string;
}

export interface ProcessDeltaResult {
  novos: ExcelIntegrante[];
  atualizados: Array<{
    antigo: IntegrantePortal;
    novo: ExcelIntegrante;
  }>;
  semMudanca: number;
  removidos: IntegrantePortal[];
}

export const parseExcelFile = async (file: File): Promise<ExcelIntegrante[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const integrantes: ExcelIntegrante[] = jsonData.map((row: any) => {
          // Detectar colunas com nomes variaveis
          const comando = row.comando || row.Comando || row.COMANDO || '';
          const regional = row.regional || row.Regional || row.REGIONAL || '';
          const divisao = row.divisao || row.Divisao || row.Divisão || row.DIVISAO || '';
          const id_integrante = parseInt(
            row.id_integrante || row.ID_Integrante || row.registro || row.Registro || '0'
          );
          const nome_colete = row.nome_colete || row.Nome_Colete || row['Nome Colete'] || row.nome || row.Nome || '';
          const cargo_grau = row.cargo_grau || row.Cargo_Grau || row['Cargo Grau'] || row.cargo || row.Cargo || '';

          return {
            comando: comando.trim(),
            regional: regional.trim(),
            divisao: divisao.trim(),
            id_integrante,
            nome_colete: nome_colete.trim(),
            cargo_grau: cargo_grau.trim(),
          };
        });

        // Validar dados
        const validos = integrantes.filter(
          (i) =>
            i.id_integrante > 0 &&
            i.nome_colete &&
            i.comando &&
            i.regional &&
            i.divisao &&
            i.cargo_grau
        );

        resolve(validos);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo Excel: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
};

export const processDelta = (
  excelData: ExcelIntegrante[],
  dbData: IntegrantePortal[]
): ProcessDeltaResult => {
  const novos: ExcelIntegrante[] = [];
  const atualizados: Array<{ antigo: IntegrantePortal; novo: ExcelIntegrante }> = [];
  let semMudanca = 0;

  const dbMap = new Map(dbData.map((i) => [i.registro_id, i]));
  const excelIds = new Set(excelData.map((i) => i.id_integrante));

  // Verificar novos e atualizados
  excelData.forEach((excelItem) => {
    const dbItem = dbMap.get(excelItem.id_integrante);

    if (!dbItem) {
      // Novo integrante
      novos.push(excelItem);
    } else {
      // Verificar se houve mudanca
      const mudou =
        dbItem.nome_colete !== excelItem.nome_colete ||
        dbItem.comando_texto !== excelItem.comando ||
        dbItem.regional_texto !== excelItem.regional ||
        dbItem.divisao_texto !== excelItem.divisao ||
        dbItem.cargo_grau_texto !== excelItem.cargo_grau;

      if (mudou) {
        atualizados.push({ antigo: dbItem, novo: excelItem });
      } else {
        semMudanca++;
      }
    }
  });

  // Verificar removidos (existem no DB mas nao no Excel)
  const removidos = dbData.filter((dbItem) => !excelIds.has(dbItem.registro_id));

  return {
    novos,
    atualizados,
    semMudanca,
    removidos,
  };
};

export const parseCargoGrau = (cargoGrauTexto: string): { cargo: string; grau: string | null } => {
  // Padroes: "Diretor Regional Grau V", "Full Grau X", "Prospect"
  const match = cargoGrauTexto.match(/(.+?)\s+Grau\s+([IVX]+)/i);
  
  if (match) {
    return {
      cargo: match[1].trim(),
      grau: match[2].toUpperCase(),
    };
  }

  // Se nao tem grau, retornar apenas o cargo
  return {
    cargo: cargoGrauTexto.trim(),
    grau: null,
  };
};
