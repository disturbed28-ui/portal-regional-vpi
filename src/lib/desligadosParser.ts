import * as XLSX from 'xlsx';

export type MotivoDesligamento = 'desligado' | 'expulso';

export interface DesligadoExcel {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  cargo_grau_texto: string;
  cargo_nome: string | null;
  grau: string | null;
  tipo_label: string; // texto original do Excel (ex: "Desligado Definitivo", "Expulso")
  motivo_inativacao: MotivoDesligamento;
  data_desligamento: string; // ISO YYYY-MM-DD
  data_inferida: boolean; // true quando a data veio da data mais antiga da planilha
}

export interface ParseDesligadosResult {
  desligados: DesligadoExcel[];
  erros: string[];
  estatisticas: {
    total: number;
    porDivisao: Record<string, number>;
    expulsos: number;
    datasInferidas: number;
  };
}

// Converter DD/MM/YYYY (ou Date do xlsx) para YYYY-MM-DD
function convertDateFormat(value: any): string | null {
  if (value === undefined || value === null || value === '') return null;

  // Caso o xlsx tenha interpretado como Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Extrair cargo + grau de textos como "Meio (Grau IX)", "Sgt Armas Full (Grau VIII)"
function parseCargoGrau(texto: string): { cargo: string | null; grau: string | null } {
  if (!texto) return { cargo: null, grau: null };
  const m = texto.match(/(.+?)\s*\(Grau\s+([IVX]+)\)/i);
  if (m) {
    return { cargo: m[1].trim(), grau: m[2].toUpperCase() };
  }
  const m2 = texto.match(/(.+?)\s+Grau\s+([IVX]+)/i);
  if (m2) {
    return { cargo: m2[1].trim(), grau: m2[2].toUpperCase() };
  }
  return { cargo: texto.trim(), grau: null };
}

function mapMotivo(tipoLabel: string): MotivoDesligamento {
  const t = (tipoLabel || '').toLowerCase();
  if (t.includes('expuls')) return 'expulso';
  return 'desligado';
}

export async function parseDesligadosExcel(file: File): Promise<ParseDesligadosResult> {
  const erros: string[] = [];
  const porDivisao: Record<string, number> = {};

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][];

  // Pré-parse: coletar linhas cruas com divisão atual
  interface RawRow {
    linha: number;
    registro_id: number;
    nome_colete: string;
    divisao_texto: string;
    cargo_grau_texto: string;
    tipo_label: string;
    data_iso: string | null;
  }

  const raws: RawRow[] = [];
  let divisaoAtual = '';
  let headerVisto = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }

    const firstCell = String(row[0] ?? '').trim();
    const secondCell = row[1];

    // Linha de divisão: col0 contém "divis" e col1 vazia
    if ((secondCell === undefined || secondCell === null || String(secondCell).trim() === '') && /divis/i.test(firstCell)) {
      divisaoAtual = firstCell.replace(/^divis[ãa]o\s*/i, '').trim();
      headerVisto = false;
      continue;
    }

    // Linha de cabeçalho
    if (/^(n[uú]mero)$/i.test(firstCell)) {
      headerVisto = true;
      continue;
    }

    // Linha de dados: col0 numérico
    if (/^\d+$/.test(firstCell)) {
      if (!divisaoAtual) {
        erros.push(`Linha ${i + 1}: registro ${firstCell} sem divisão identificada — ignorado`);
        continue;
      }
      const registro_id = parseInt(firstCell, 10);
      const nome_colete = String(row[1] ?? '').trim();
      const cargo_grau_texto = String(row[2] ?? '').trim();
      const tipo_label = String(row[3] ?? 'Desligado Definitivo').trim();
      const data_iso = convertDateFormat(row[4]);

      if (!nome_colete) {
        erros.push(`Linha ${i + 1}: registro ${registro_id} sem apelido — ignorado`);
        continue;
      }

      raws.push({ linha: i + 1, registro_id, nome_colete, divisao_texto: divisaoAtual, cargo_grau_texto, tipo_label, data_iso });
    }
  }

  // Data mais antiga da planilha (para preencher as vazias)
  const datasValidas = raws.map((r) => r.data_iso).filter((d): d is string => !!d).sort();
  const dataMaisAntiga = datasValidas[0] || new Date().toISOString().split('T')[0];

  const desligados: DesligadoExcel[] = [];
  let expulsos = 0;
  let datasInferidas = 0;

  for (const r of raws) {
    const { cargo, grau } = parseCargoGrau(r.cargo_grau_texto);
    const motivo = mapMotivo(r.tipo_label);
    if (motivo === 'expulso') expulsos++;

    const inferida = !r.data_iso;
    if (inferida) datasInferidas++;

    desligados.push({
      registro_id: r.registro_id,
      nome_colete: r.nome_colete,
      divisao_texto: r.divisao_texto,
      cargo_grau_texto: r.cargo_grau_texto,
      cargo_nome: cargo,
      grau,
      tipo_label: r.tipo_label,
      motivo_inativacao: motivo,
      data_desligamento: r.data_iso || dataMaisAntiga,
      data_inferida: inferida,
    });

    porDivisao[r.divisao_texto] = (porDivisao[r.divisao_texto] || 0) + 1;
  }

  return {
    desligados,
    erros,
    estatisticas: {
      total: desligados.length,
      porDivisao,
      expulsos,
      datasInferidas,
    },
  };
}
