import * as XLSX from 'xlsx';
import { IntegrantePortal } from '@/hooks/useIntegrantes';

// Normaliza texto para comparação (ignora case, acentos e espaços extras)
function normalizarParaComparacao(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .replace(/\s+/g, ' ')              // Normaliza espaços
    .trim();
}

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

export interface TransferenciaDetectada {
  integrante: IntegrantePortal;
  nova_regional: string;
  nova_divisao: string;
}

export interface ProcessDeltaResult {
  novos: ExcelIntegrante[];
  atualizados: Array<{
    antigo: IntegrantePortal;
    novo: ExcelIntegrante;
  }>;
  semMudanca: number;
  removidos: IntegrantePortal[];
  transferidos: TransferenciaDetectada[];
  regional_detectada: string;
}

// Converter data do formato DD/MM/YYYY para YYYY-MM-DD (formato ISO)
function convertDateFormat(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  
  const trimmed = String(dateStr).trim();
  if (trimmed === '') return null;
  
  // Se já está no formato ISO (YYYY-MM-DD), retorna direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Converter DD/MM/YYYY para YYYY-MM-DD
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  console.warn('[Excel Parser] ⚠️ Formato de data não reconhecido:', trimmed);
  return null;
}

// Função auxiliar para normalizar nomes de colunas
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[_\s-]/g, '') // Remove underscores, espaços e hífens
    .trim();
};

// Função auxiliar para buscar valor de coluna com variações
const findColumnValue = (row: any, ...variations: string[]): any => {
  // Primeiro tenta busca exata
  for (const variation of variations) {
    if (row[variation] !== undefined) {
      return row[variation];
    }
  }
  
  // Se não encontrou, tenta busca normalizada
  const rowKeys = Object.keys(row);
  const normalizedVariations = variations.map(v => normalizeColumnName(v));
  
  for (const key of rowKeys) {
    const normalizedKey = normalizeColumnName(key);
    if (normalizedVariations.includes(normalizedKey)) {
      return row[key];
    }
  }
  
  return undefined;
};

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

        // Log das colunas disponíveis no Excel
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any;
          const availableColumns = Object.keys(firstRow);
          console.log('[Excel Parser] 📋 Colunas disponíveis no arquivo:', availableColumns);
          console.log('[Excel Parser] 📋 Colunas normalizadas:', availableColumns.map(c => ({
            original: c,
            normalizada: normalizeColumnName(c)
          })));
        }

        const integrantes: ExcelIntegrante[] = jsonData.map((row: any, index: number) => {
          // Buscar colunas com todas as variações possíveis
          const comando = findColumnValue(row, 'comando', 'Comando', 'COMANDO') || '';
          const regional = findColumnValue(row, 'regional', 'Regional', 'REGIONAL') || '';
          const divisao = findColumnValue(row, 'divisao', 'Divisao', 'Divisão', 'DIVISAO') || '';
          
          // Buscar ID com TODAS as variações possíveis
          const idValue = findColumnValue(
            row,
            'id_integrante',
            'ID_Integrante', 
            'id__integrante',
            'ID__Integrante',
            'id integrante',
            'ID Integrante',
            'idintegrante',
            'IdIntegrante',
            'registro',
            'Registro',
            'REGISTRO',
            'id',
            'ID',
            'Id'
          );
          
          const id_integrante = parseInt(String(idValue || '0'));
          
          const nome_colete = findColumnValue(
            row,
            'nome_colete',
            'Nome_Colete',
            'NomeColete',
            'Nome Colete',
            'nome',
            'Nome',
            'NOME'
          ) || '';
          
          // Ampliar mapeamento de cargo_grau com TODAS as variações possíveis
          const cargo_grau = findColumnValue(
            row,
            'cargo_grau',
            'Cargo_Grau',
            'Cargo Grau',
            'cargo grau',
            'CARGO_GRAU',
            'CARGO GRAU',
            'cargo',
            'Cargo',
            'CargoGrau',
            'cargoGrau'
          ) || '';
          
          const cargo_estagio = findColumnValue(
            row,
            'cargo_estagio',
            'Cargo_Estagio',
            'CargoEstagio',
            'Estagio',
            'estagio'
          ) || '';
          
          // Log detalhado do primeiro registro
          if (index === 0) {
            console.log('[Excel Parser] 🔍 Primeiro registro parseado:', {
              id_integrante,
              idValue_bruto: idValue,
              nome_colete,
              cargo_grau,
              comando,
              regional,
              divisao,
              registro_completo: row
            });
          }
          
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
            // Converter formato brasileiro DD/MM/YYYY para ISO YYYY-MM-DD
            return convertDateFormat(value.toString()) || undefined;
          };

          return {
            comando: String(comando).trim(),
            regional: String(regional).trim(),
            divisao: String(divisao).trim(),
            id_integrante,
            nome_colete: String(nome_colete).trim(),
            cargo_grau: String(cargo_grau).trim(),
            cargo_estagio: cargo_estagio ? String(cargo_estagio).trim() : undefined,
            sgt_armas: converterBool(findColumnValue(row, 'SgtArmas', 'sgt_armas')),
            caveira: converterBool(findColumnValue(row, 'Caveira', 'caveira')),
            caveira_suplente: converterBool(findColumnValue(row, 'CaveiraSuplente', 'caveira_suplente')),
            batedor: converterBool(findColumnValue(row, 'Batedor', 'batedor')),
            ursinho: converterBool(findColumnValue(row, 'Ursinho', 'ursinho')),
            lobo: converterBool(findColumnValue(row, 'Lobo', 'lobo')),
            tem_moto: converterBool(findColumnValue(row, 'TemMoto', 'tem_moto')),
            tem_carro: converterBool(findColumnValue(row, 'TemCarro', 'tem_carro')),
            data_entrada: parseData(findColumnValue(row, 'data_entrada', 'data__entrada')),
          };
        });

        // Validar dados com log mais detalhado
        const validos = integrantes.filter((i, index) => {
          const isValid = 
            i.id_integrante > 0 &&
            i.nome_colete &&
            i.nome_colete.trim().length > 0 &&
            i.comando &&
            i.regional &&
            i.divisao &&
            i.cargo_grau &&
            i.cargo_grau.trim().length > 0;
          
          if (!isValid && index < 5) {
            console.warn('[Excel Parser] ⚠️ Registro inválido (linha ' + (index + 2) + '):', {
              id_integrante: i.id_integrante,
              nome_colete: i.nome_colete,
              cargo_grau: i.cargo_grau,
              problemas: {
                id_invalido: i.id_integrante <= 0,
                sem_nome: !i.nome_colete || i.nome_colete.trim().length === 0,
                sem_comando: !i.comando,
                sem_regional: !i.regional,
                sem_divisao: !i.divisao,
                sem_cargo: !i.cargo_grau || i.cargo_grau.trim().length === 0
              }
            });
          }
          
          return isValid;
        });

        // Verificar se todos os IDs são 0 ou inválidos
        const idsValidos = validos.filter(i => i.id_integrante > 0);
        const todosIdsZero = validos.length > 0 && idsValidos.length === 0;
        
        if (todosIdsZero) {
          console.error('[Excel Parser] ❌ ERRO CRÍTICO: Todos os IDs são 0 ou inválidos!');
          console.error('[Excel Parser] 📋 Verifique se a coluna de ID está com o nome correto no Excel');
          throw new Error('Coluna de ID não encontrada no arquivo. Verifique se existe uma coluna chamada "id_integrante", "registro" ou similar.');
        }

        // Log de estatísticas
        console.log('[Excel Parser] ✅ Parse concluído:', {
          total_linhas: jsonData.length,
          registros_validos: validos.length,
          registros_invalidos: jsonData.length - validos.length,
          ids_unicos: new Set(validos.map(i => i.id_integrante)).size,
          exemplo_ids: validos.slice(0, 5).map(i => i.id_integrante)
        });

        resolve(validos);
      } catch (error) {
        console.error('[Excel Parser] 💥 Erro ao processar arquivo:', error);
        reject(new Error('Erro ao processar arquivo Excel: ' + error));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
};

// Detectar a regional predominante na carga do Excel
const detectarRegionalDaCarga = (excelData: ExcelIntegrante[]): string => {
  const contagem = new Map<string, number>();
  excelData.forEach(item => {
    const regional = item.regional?.trim();
    if (regional) {
      contagem.set(regional, (contagem.get(regional) || 0) + 1);
    }
  });
  
  let maiorRegional = '';
  let maiorContagem = 0;
  contagem.forEach((count, regional) => {
    if (count > maiorContagem) {
      maiorContagem = count;
      maiorRegional = regional;
    }
  });
  
  console.log('[processDelta] 📊 Regional detectada na carga:', maiorRegional, `(${maiorContagem}/${excelData.length} registros)`);
  return maiorRegional;
};

export const processDelta = (
  excelData: ExcelIntegrante[],
  dbData: IntegrantePortal[],
  todosIntegrantesAtivos?: IntegrantePortal[]
): ProcessDeltaResult => {
  const novos: ExcelIntegrante[] = [];
  const atualizados: Array<{ antigo: IntegrantePortal; novo: ExcelIntegrante }> = [];
  let semMudanca = 0;

  // Detectar a regional da carga
  const regionalDaCarga = detectarRegionalDaCarga(excelData);
  
  // Filtrar dbData apenas para integrantes da regional da carga
  const dbDataFiltrado = regionalDaCarga 
    ? dbData.filter(i => i.regional_texto === regionalDaCarga)
    : dbData;
  
  console.log('[processDelta] 📋 Integrantes no DB da regional:', dbDataFiltrado.length, 'de', dbData.length, 'total');

  const dbMap = new Map(dbDataFiltrado.map((i) => [i.registro_id, i]));
  const excelIds = new Set(excelData.map((i) => i.id_integrante));

  // Verificar novos e atualizados
  excelData.forEach((excelItem) => {
    const dbItem = dbMap.get(excelItem.id_integrante);

    if (!dbItem) {
      // Novo integrante
      novos.push(excelItem);
    } else {
      // Verificar se houve mudança (usando comparação normalizada para textos)
      const mudou =
        normalizarParaComparacao(dbItem.nome_colete) !== normalizarParaComparacao(excelItem.nome_colete) ||
        normalizarParaComparacao(dbItem.comando_texto) !== normalizarParaComparacao(excelItem.comando) ||
        normalizarParaComparacao(dbItem.regional_texto) !== normalizarParaComparacao(excelItem.regional) ||
        normalizarParaComparacao(dbItem.divisao_texto) !== normalizarParaComparacao(excelItem.divisao) ||
        normalizarParaComparacao(dbItem.cargo_grau_texto) !== normalizarParaComparacao(excelItem.cargo_grau) ||
        normalizarParaComparacao(dbItem.cargo_estagio) !== normalizarParaComparacao(excelItem.cargo_estagio || null) ||
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

  // Verificar removidos da regional (existem no DB da regional mas nao no Excel)
  const candidatosRemocao = dbDataFiltrado.filter((dbItem) => !excelIds.has(dbItem.registro_id));
  
  // Separar removidos de transferidos
  const removidos: IntegrantePortal[] = [];
  const transferidos: TransferenciaDetectada[] = [];
  
  // Usar todosIntegrantesAtivos se disponível, senão usar dbData
  const todosAtivos = todosIntegrantesAtivos || dbData;
  
  for (const candidato of candidatosRemocao) {
    // Verificar se este integrante existe ATIVO em OUTRA regional
    const emOutraRegional = todosAtivos.find(
      i => i.registro_id === candidato.registro_id && 
           i.regional_texto !== regionalDaCarga &&
           i.ativo === true
    );
    
    if (emOutraRegional) {
      // É uma transferência, não uma remoção!
      transferidos.push({
        integrante: candidato,
        nova_regional: emOutraRegional.regional_texto,
        nova_divisao: emOutraRegional.divisao_texto
      });
      console.log('[processDelta] 🔄 Transferência detectada:', candidato.nome_colete, 
        `${regionalDaCarga} → ${emOutraRegional.regional_texto}`);
    } else {
      // Realmente sumiu, candidato a inativação
      removidos.push(candidato);
    }
  }
  
  console.log('[processDelta] 📊 Resultado:', {
    novos: novos.length,
    atualizados: atualizados.length,
    semMudanca,
    removidos: removidos.length,
    transferidos: transferidos.length,
    regional_detectada: regionalDaCarga
  });

  return {
    novos,
    atualizados,
    semMudanca,
    removidos,
    transferidos,
    regional_detectada: regionalDaCarga
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
