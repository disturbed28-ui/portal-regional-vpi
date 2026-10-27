// @ts-expect-error Deno resolves npm specifiers; Bun tests alias this to the project dependency.
import { z } from 'npm:zod@3.25.76';

// Open questions shown in the form. Indexes 4 and 6 are optional.
export const PERGUNTAS = [
  'Qual ou quais são seus objetivos dentro do INSANOS MC?',
  'O que te motiva a participar da divisão avaliada?',
  'Quais os pontos negativos que você vê hoje na divisão avaliada?',
  'Quais os pontos positivos que você vê hoje na divisão avaliada?',
  'Como seria um motoclube ideal para você participar?',
  'Se você fosse o diretor dessa divisão, o que faria para melhorar?',
  'Observações gerais: o que gostaria de registrar para a melhoria contínua da divisão?',
];
export const OPCIONAIS = [4, 6];
// Sheet columns are fixed: the retired "sentimento" column (K) stays in place, left blank for new
// answers, and the new scores are appended at Q-S so existing rows never shift. If the sheet was
// wiped, the function rewrites this header before appending; a missing spreadsheet still fails.
// Activity question (multi-choice, max 2). Stored in T (codes), U (Outros text) and one 0/1 column per
// option (V-AC) so counts and percentages per option, division and regional are simple sums.
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
export const PERGUNTA_ATIVIDADES = 'Que tipo de atividade você considera que sua divisão deveria promover com mais frequência?';
const codigos = ATIVIDADES.map(a => a.codigo) as [string, ...string[]];
export const CABECALHO = ['Data/hora', 'Comando ID', 'Comando', 'Regional ID', 'Regional', 'Divisão ID', 'Divisão', 'Nota de satisfação (1-5)',
  PERGUNTAS[0], PERGUNTAS[1], 'Qual o seu sentimento hoje a respeito da divisão avaliada?', PERGUNTAS[2], PERGUNTAS[3], PERGUNTAS[4], PERGUNTAS[5], PERGUNTAS[6],
  'Nota de pertencimento (1-5)', 'Nota de liderança e comunicação (1-5)', 'Nota de atividades e integração (1-5)',
  'Atividades sugeridas (códigos)', 'Atividade sugerida - Outros (texto)', ...ATIVIDADES.map(a => `Atividade: ${a.rotulo}`)];
const nota = z.number().int().min(1).max(5);
export const respostaSchema = z.object({
  comandoId: z.string().uuid(), regionalId: z.string().uuid(), divisaoId: z.string().uuid(),
  nota, pertencimento: nota, lideranca: nota, atividades: nota,
  respostas: z.array(z.string().max(5000).transform(s => s.trim())).length(7)
    .refine(rs => rs.every((r, i) => OPCIONAIS.includes(i) || r.length > 0), 'Preencha as perguntas obrigatórias.'),
  atividadesSugeridas: z.array(z.enum(codigos)).min(1).max(2)
    .refine(a => new Set(a).size === a.length, 'Opções repetidas.')
    .refine(a => !a.includes('NENHUMA') || a.length === 1, '"Nenhuma" é exclusiva.'),
  atividadeOutros: z.string().max(500).transform(s => s.trim()).default(''),
}).strict().refine(p => !p.atividadesSugeridas.includes('OUTROS') || p.atividadeOutros.length > 0, 'Especifique a atividade em "Outros".')
  .transform(p => ({ ...p, atividadeOutros: p.atividadesSugeridas.includes('OUTROS') ? p.atividadeOutros : '' }));
export interface Hierarquia {
  comandos: { id: string; nome: string }[];
  regionais: { id: string; comandoId: string; nome: string; sigla: string }[];
  divisoes: { id: string; regionalId: string; nome: string }[];
  perguntas: string[];
  atividades?: { codigo: string; rotulo: string }[];
  perguntaAtividades?: string;
}
export function hierarquiaDasAbas(abas: { values?: string[][] }[]): Hierarquia {
  const rows = (i: number) => (abas[i]?.values || []).slice(1).filter(r => r[0]);
  const comandos = rows(0).map(r => ({ id: r[0], nome: r[1] || '' }));
  const regionais = rows(1).filter(r => (r[3] || '').trim().toUpperCase() !== 'CMD')
    .map(r => ({ id: r[0], comandoId: r[1], nome: r[3] || '', sigla: r[4] || '' }));
  const divisoes = rows(2).filter(r => /^DIVISAO\s/i.test(r[5] || '') && !/^DIVISAO\s+REGIONAL(?:\s|$)/i.test(r[5] || ''))
    .filter(r => regionais.some(reg => reg.id === r[1]))
    .map(r => ({ id: r[0], regionalId: r[1], nome: r[5] }));
  return { comandos, regionais, divisoes, perguntas: PERGUNTAS, atividades: ATIVIDADES.map(a => ({ ...a })), perguntaAtividades: PERGUNTA_ATIVIDADES };
}
export function linhaDaResposta(input: unknown, dados: Hierarquia, agora = new Date()) {
  const payload = respostaSchema.parse(input);
  const comando = dados.comandos.find(c => c.id === payload.comandoId);
  const regional = dados.regionais.find(r => r.id === payload.regionalId && r.comandoId === payload.comandoId);
  const divisao = dados.divisoes.find(d => d.id === payload.divisaoId && d.regionalId === payload.regionalId);
  if (!comando || !regional || !divisao) throw new Error('Seleção hierárquica inválida.');
  // Sheets dates are serials in the spreadsheet's local timezone (São Paulo).
  const data = (agora.getTime() - 3 * 3600000) / 86400000 + 25569;
  const r = payload.respostas.map(t => /^[=+\-@]/.test(t) ? "'" + t : t);
  return [data, comando.id, comando.nome, regional.id, regional.nome, divisao.id, divisao.nome,
    payload.nota, r[0], r[1], '', r[2], r[3], r[4], r[5], r[6],
    payload.pertencimento, payload.lideranca, payload.atividades,
    payload.atividadesSugeridas.join('; '), /^[=+\-@]/.test(payload.atividadeOutros) ? "'" + payload.atividadeOutros : payload.atividadeOutros,
    ...ATIVIDADES.map(a => payload.atividadesSugeridas.includes(a.codigo) ? 1 : 0)];
}
