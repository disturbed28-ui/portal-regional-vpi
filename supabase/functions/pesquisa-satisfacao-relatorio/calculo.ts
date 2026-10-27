// Pure calculation over the raw sheet rows ('Respostas Pesquisa'!A2:AC, UNFORMATTED_VALUE).
// Column layout is fixed by pesquisa-satisfacao/model.ts (CABECALHO). Old rows may lack Q-AC.

export const ATIVIDADES = [
  { codigo: 'ACOES_SOCIAIS', rotulo: 'Ações sociais' },
  { codigo: 'BATE_VOLTAS', rotulo: 'Bate-voltas e rolês curtos' },
  { codigo: 'VIAGENS_LONGAS', rotulo: 'Viagens de longa distância' },
  { codigo: 'ENCONTROS', rotulo: 'Encontros e confraternizações' },
  { codigo: 'EVENTOS_OUTROS_MC', rotulo: 'Participação em eventos de outros motoclubes' },
  { codigo: 'INTEGRACAO_DIVISOES', rotulo: 'Atividades de integração entre divisões' },
  { codigo: 'NENHUMA', rotulo: 'Nenhuma — considero a programação atual adequada' },
  { codigo: 'OUTROS', rotulo: 'Outros' },
] as const;

// Open answers: I, J, L, M, N, O, P (K is the retired "sentimento" column, ignored).
export const ABERTAS = [
  { col: 8, chave: 'objetivos', rotulo: 'Objetivos no INSANOS MC' },
  { col: 9, chave: 'motivacao', rotulo: 'Motivação para participar' },
  { col: 11, chave: 'negativos', rotulo: 'Pontos negativos' },
  { col: 12, chave: 'positivos', rotulo: 'Pontos positivos' },
  { col: 13, chave: 'ideal', rotulo: 'Motoclube ideal' },
  { col: 14, chave: 'melhoria', rotulo: 'Se fosse diretor' },
  { col: 15, chave: 'observacoes', rotulo: 'Observações gerais' },
] as const;

export const INDICADORES = [
  { col: 7, chave: 'satisfacao', rotulo: 'Satisfação geral' },
  { col: 16, chave: 'pertencimento', rotulo: 'Pertencimento' },
  { col: 17, chave: 'lideranca', rotulo: 'Liderança e comunicação' },
  { col: 18, chave: 'atividades', rotulo: 'Atividades e integração' },
] as const;

export interface Resposta {
  mes: string; // YYYY-MM (São Paulo); exact time is never exposed
  regionalId: string;
  divisaoId: string;
  divisao: string;
  notas: Record<string, number | null>;
  atividades: string[];
  outros: string;
  abertas: Record<string, string>;
}

const texto = (v: unknown) => (v === undefined || v === null ? '' : String(v)).replace(/^'/, '').trim();

/** Sheets serial (already in São Paulo local time) → YYYY-MM. Accepts dd/mm/yyyy strings from older rows. */
export function mesDaData(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto(v));
  return m ? `${m[3]}-${m[2].padStart(2, '0')}` : null;
}

function nota(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export function parseLinhas(rows: unknown[][]): Resposta[] {
  const out: Resposta[] = [];
  for (const r of rows) {
    const mes = mesDaData(r[0]);
    const regionalId = texto(r[3]);
    const divisaoId = texto(r[5]);
    if (!mes || !regionalId || !divisaoId) continue;
    const codigosValidos = new Set(ATIVIDADES.map(a => a.codigo as string));
    let atividades = [...new Set(texto(r[19]).split(/[;,]/).map(s => s.trim().toUpperCase()).filter(c => codigosValidos.has(c)))];
    if (!atividades.length) atividades = ATIVIDADES.filter((_, i) => Number(r[21 + i]) === 1).map(a => a.codigo);
    out.push({
      mes, regionalId, divisaoId, divisao: texto(r[6]),
      notas: Object.fromEntries(INDICADORES.map(i => [i.chave, nota(r[i.col])])),
      atividades, outros: atividades.includes('OUTROS') ? texto(r[20]) : '',
      abertas: Object.fromEntries(ABERTAS.map(a => [a.chave, texto(r[a.col])])),
    });
  }
  return out;
}

export function indicadores(rs: Resposta[]) {
  const medias = INDICADORES.map(i => {
    const vals = rs.map(r => r.notas[i.chave]).filter((n): n is number => n !== null);
    return { chave: i.chave, rotulo: i.rotulo, avaliacoes: vals.length,
      media: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
  });
  const comAtividade = rs.filter(r => r.atividades.length > 0);
  const contagem = (c: string) => comAtividade.filter(r => r.atividades.includes(c)).length;
  const pct = (n: number) => comAtividade.length ? Math.round((n / comAtividade.length) * 1000) / 10 : 0;
  const atividades = ATIVIDADES.filter(a => a.codigo !== 'NENHUMA')
    .map(a => ({ codigo: a.codigo, rotulo: a.rotulo, quantidade: contagem(a.codigo), percentual: pct(contagem(a.codigo)) }))
    .sort((a, b) => b.quantidade - a.quantidade);
  const nenhuma = contagem('NENHUMA');
  return { respostas: rs.length, medias, atividades,
    programacaoAdequada: { quantidade: nenhuma, percentual: pct(nenhuma) },
    respondentesAtividades: comAtividade.length };
}

/** Month range filter, inclusive. Only whole months are allowed so periods can't isolate single answers. */
export const noPeriodo = (r: Resposta, inicio: string, fim: string) => r.mes >= inicio && r.mes <= fim;

/** Text sent to the AI: only open answers + "Outros" text. Empty fields skipped. */
export function textoParaIa(r: Resposta) {
  const partes: Record<string, string> = {};
  for (const a of ABERTAS) if (r.abertas[a.chave]) partes[a.rotulo] = r.abertas[a.chave];
  if (r.outros) partes['Atividade sugerida (Outros)'] = r.outros;
  return partes;
}

export async function hashDe(valor: unknown) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(valor)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
