// @ts-expect-error Deno resolves npm specifiers; Bun tests alias this to the project dependency.
import { z } from 'npm:zod@3.25.76';

export const PERGUNTAS = [
  'Qual ou quais são seus objetivos dentro do INSANOS MC?',
  'O que te motiva a participar da divisão avaliada?',
  'Qual o seu sentimento hoje a respeito da divisão avaliada?',
  'Quais os pontos negativos que você vê hoje na divisão avaliada?',
  'Quais os pontos positivos que você vê hoje na divisão avaliada?',
  'Como seria um motoclube ideal para você participar?',
  'Se você fosse o diretor dessa divisão, o que faria para melhorar?',
  'Observações gerais: o que gostaria de registrar para a melhoria contínua da divisão?',
];
export const CABECALHO = ['Data/hora', 'Comando ID', 'Comando', 'Regional ID', 'Regional', 'Divisão ID', 'Divisão', 'Nota de satisfação (1-5)', ...PERGUNTAS];
export const respostaSchema = z.object({
  comandoId: z.string().uuid(), regionalId: z.string().uuid(), divisaoId: z.string().uuid(),
  nota: z.number().int().min(1).max(5),
  respostas: z.array(z.string().max(5000).transform(s => s.trim())).length(8)
    .refine(rs => rs.every((r, i) => i === 5 || r.length > 0), 'Preencha as perguntas obrigatórias.'),
}).strict();
export interface Hierarquia {
  comandos: { id: string; nome: string }[];
  regionais: { id: string; comandoId: string; nome: string; sigla: string }[];
  divisoes: { id: string; regionalId: string; nome: string }[];
  perguntas: string[];
}
export function hierarquiaDasAbas(abas: { values?: string[][] }[]): Hierarquia {
  const rows = (i: number) => (abas[i]?.values || []).slice(1).filter(r => r[0]);
  const comandos = rows(0).map(r => ({ id: r[0], nome: r[1] || '' }));
  const regionais = rows(1).filter(r => (r[3] || '').trim().toUpperCase() !== 'CMD')
    .map(r => ({ id: r[0], comandoId: r[1], nome: r[3] || '', sigla: r[4] || '' }));
  const divisoes = rows(2).filter(r => /^DIVISAO\s/i.test(r[5] || '') && !/^DIVISAO\s+REGIONAL(?:\s|$)/i.test(r[5] || ''))
    .filter(r => regionais.some(reg => reg.id === r[1]))
    .map(r => ({ id: r[0], regionalId: r[1], nome: r[5] }));
  return { comandos, regionais, divisoes, perguntas: PERGUNTAS };
}
export function linhaDaResposta(input: unknown, dados: Hierarquia, agora = new Date()) {
  const payload = respostaSchema.parse(input);
  const comando = dados.comandos.find(c => c.id === payload.comandoId);
  const regional = dados.regionais.find(r => r.id === payload.regionalId && r.comandoId === payload.comandoId);
  const divisao = dados.divisoes.find(d => d.id === payload.divisaoId && d.regionalId === payload.regionalId);
  if (!comando || !regional || !divisao) throw new Error('Seleção hierárquica inválida.');
  // Sheets dates are serials in the spreadsheet's local timezone (São Paulo).
  const data = (agora.getTime() - 3 * 3600000) / 86400000 + 25569;
  return [data, comando.id, comando.nome, regional.id, regional.nome, divisao.id, divisao.nome,
    payload.nota, ...payload.respostas.map(r => /^[=+\-@]/.test(r) ? "'" + r : r)];
}