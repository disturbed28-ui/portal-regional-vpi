import * as XLSX from 'xlsx';
import { IntegrantePortal } from '@/hooks/useIntegrantes';

export interface ExcelIntegrante {
  comando: string;
  regional: string;
  divisao: string;
  id_integrante: number;
  nome_colete: string;
  cargo_grau: string;
  cargo_estagio?: string;
  sgt_armas?: boolean;
  caveira?: boolean;
  caveira_suplente?: boolean;
  batedor?: boolean;
  ursinho?: boolean;
  lobo?: boolean;
  tem_moto?: boolean;
  tem_carro?: boolean;
  data_entrada?: string;
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
            row.id_integrante || row.ID_Integrante || row.id__integrante || row.registro || row.Registro || '0'
          );
          const nome_colete = row.nome_colete || row.Nome_Colete || row.NomeColete || row['Nome Colete'] || row.nome || row.Nome || '';
          const cargo_grau = row.cargo_grau || row.Cargo_Grau || row['Cargo Grau'] || row.cargo || row.Cargo || '';
          const cargo_estagio = row.cargo_estagio || row.Cargo_Estagio || row.CargoEstagio || '';
          
          // Converter campos S/N para boolean
          const converterBool = (value: any) => value === 'S' || value === 's' || value === true;
          
          // Parsear data de entrada
          const parseData = (value: any) => {
            if (!value) return undefined;
            if (typeof value === 'number') {
              // Excel serial date
              const date = new Date((value - 25569) * 86400 * 1000);
              return date.toISOString().split('T')[0];
            }
            if (value instanceof Date) {
              return value.toISOString().split('T')[0];
            }
            return value.toString();
          };

          return {
            comando: comando.trim(),
            regional: regional.trim(),
            divisao: divisao.trim(),
            id_integrante,
            nome_colete: nome_colete.trim(),
            cargo_grau: cargo_grau.trim(),
            cargo_estagio: cargo_estagio.trim() || undefined,
            sgt_armas: converterBool(row.SgtArmas || row.sgt_armas),
            caveira: converterBool(row.Caveira || row.caveira),
            caveira_suplente: converterBool(row.CaveiraSuplente || row.caveira_suplente),
            batedor: converterBool(row.Batedor || row.batedor),
            ursinho: converterBool(row.Ursinho || row.ursinho),
            lobo: converterBool(row.Lobo || row.lobo),
            tem_moto: converterBool(row.TemMoto || row.tem_moto),
            tem_carro: converterBool(row.TemCarro || row.tem_carro),
            data_entrada: parseData(row.data_entrada || row.data__entrada),
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
        dbItem.cargo_grau_texto !== excelItem.cargo_grau ||
        dbItem.cargo_estagio !== (excelItem.cargo_estagio || null) ||
        dbItem.sgt_armas !== (excelItem.sgt_armas || false) ||
        dbItem.caveira !== (excelItem.caveira || false) ||
        dbItem.caveira_suplente !== (excelItem.caveira_suplente || false) ||
        dbItem.batedor !== (excelItem.batedor || false) ||
        dbItem.ursinho !== (excelItem.ursinho || false) ||
        dbItem.lobo !== (excelItem.lobo || false) ||
        dbItem.tem_moto !== (excelItem.tem_moto || false) ||
        dbItem.tem_carro !== (excelItem.tem_carro || false) ||
        dbItem.data_entrada !== (excelItem.data_entrada || null);

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
  if (!cargoGrauTexto) return { cargo: '', grau: null };
  
  // Padroes: "Diretor Regional (Grau V)", "Diretor Regional Grau V", "Full Grau X", "Prospect", "Sem Cargo"
  const matchParenteses = cargoGrauTexto.match(/(.+?)\s*\(Grau\s+([IVX]+)\)/i);
  if (matchParenteses) {
    return {
      cargo: matchParenteses[1].trim(),
      grau: matchParenteses[2].toUpperCase(),
    };
  }
  
  const matchEspaco = cargoGrauTexto.match(/(.+?)\s+Grau\s+([IVX]+)/i);
  if (matchEspaco) {
    return {
      cargo: matchEspaco[1].trim(),
      grau: matchEspaco[2].toUpperCase(),
    };
  }

  // Se nao tem grau, retornar apenas o cargo
  return {
    cargo: cargoGrauTexto.trim(),
    grau: null,
  };
};
