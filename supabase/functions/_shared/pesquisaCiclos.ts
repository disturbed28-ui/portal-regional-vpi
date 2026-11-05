export type TemaCiclo = { tema: string; resumo: string; respostas: number; divisoes: number };
export type AnaliseCiclo = { estado: string; geradoEm?: string; respostasIncluidas?: number; diagnostico?: string; recomendacoes?: string[]; pontosFortes?: TemaCiclo[]; pontosFracos?: TemaCiclo[]; sugestoes?: TemaCiclo[]; boasPraticas?: TemaCiclo[] };
export type IndicadoresCiclo = { respostas: number; participacao?: { integrantesAtivos: number; percentual: number | null }; medias: { chave: string; rotulo: string; media: number | null; avaliacoes: number }[]; atividades: { rotulo: string; quantidade: number; percentual: number }[] };
export type SnapshotCiclo = { periodo: { inicio: string; fim: string }; escopo: { nivel: string; regionalId: string; divisaoId: string | null; regionais: { id: string; nome: string }[]; divisoes: { id: string; nome: string }[] }; indicadores: IndicadoresCiclo; analise?: AnaliseCiclo; divisoes?: { divisaoId: string; nome: string; indicadores: IndicadoresCiclo; analise?: AnaliseCiclo }[]; minimo?: number; geradoEm: string; versaoAnalise: string; comparacao?: ReturnType<typeof compararCiclos> };
const listas = ['pontosFortes', 'pontosFracos', 'sugestoes', 'boasPraticas'] as const;
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
export const sobrepoe = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio <= b.fim && a.fim >= b.inicio;
export function podeFechar(cargo: string, grau: string, ativo: boolean, regional: string | null, alvo: string, permissao: boolean) {
  return permissao && ativo && regional === alvo && grau === 'V' && ['DIRETOR REGIONAL', 'DIRETOR REGIONAL GRAU V'].includes(norm(cargo));
}
function limparAnalise(a?: AnaliseCiclo): AnaliseCiclo | undefined {
  if (!a) return undefined;
  // Whitelist, never persist or export original comments or response identifiers.
  const out: AnaliseCiclo = { estado: a.estado, geradoEm: a.geradoEm, respostasIncluidas: a.respostasIncluidas };
  if (a.estado !== 'ok') return out;
  out.diagnostico = a.diagnostico;
  out.recomendacoes = a.recomendacoes;
  for (const chave of listas) out[chave] = a[chave]?.map(t => ({ tema: t.tema, resumo: t.resumo, respostas: t.respostas, divisoes: t.divisoes }));
  return out;
}
export function sanitizarSnapshot(d: SnapshotCiclo): SnapshotCiclo {
  return { periodo: d.periodo, escopo: d.escopo, indicadores: d.indicadores, minimo: Math.max(5, d.minimo || 5), geradoEm: d.geradoEm, versaoAnalise: d.versaoAnalise,
    analise: limparAnalise(d.analise), divisoes: d.divisoes?.map(v => ({ divisaoId: v.divisaoId, nome: v.nome, indicadores: v.indicadores, analise: v.indicadores.respostas >= Math.max(5, d.minimo || 5) ? limparAnalise(v.analise) : { estado: 'amostra_insuficiente' } })) };
}
export function recortarSnapshot(d: SnapshotCiclo, divisaoId: string | null): SnapshotCiclo {
  if (!divisaoId) return d;
  const v = d.divisoes?.find(v => v.divisaoId === divisaoId);
  if (!v) throw new Error('A divisão não possui resultados neste ciclo.');
  return { ...d, escopo: { ...d.escopo, nivel: 'divisao', divisaoId, divisoes: d.escopo.divisoes.filter(v => v.id === divisaoId) }, indicadores: v.indicadores, analise: v.analise, divisoes: undefined, comparacao: undefined };
}
export function compararCiclos(atual: SnapshotCiclo, anterior?: SnapshotCiclo) {
  if (!anterior) return undefined;
  const arred = (v: number) => Math.round(v * 100) / 100;
  const temas = listas.flatMap(categoria => {
    const a = atual.analise?.[categoria] || [], b = anterior.analise?.[categoria] || [];
    const na = atual.analise?.respostasIncluidas || 0, nb = anterior.analise?.respostasIncluidas || 0;
    const chaves = new Set([...a, ...b].map(t => norm(t.tema)));
    return [...chaves].map(chave => {
      const novo = a.find(t => norm(t.tema) === chave), velho = b.find(t => norm(t.tema) === chave);
      return { categoria, tema: novo?.tema || velho?.tema || chave, amostraAtual: na, amostraAnterior: nb,
        mencoesAtual: novo?.respostas || 0, mencoesAnterior: velho?.respostas || 0,
        percentualAtual: na ? arred((novo?.respostas || 0) / na * 100) : null,
        percentualAnterior: nb ? arred((velho?.respostas || 0) / nb * 100) : null,
        estado: novo && velho ? 'persistente' : novo ? 'não mencionado anteriormente' : 'não mencionado agora' };
    });
  });
  const pa = atual.indicadores.participacao?.percentual, pb = anterior.indicadores.participacao?.percentual;
  return { periodoAnterior: anterior.periodo,
    indicadores: atual.indicadores.medias.map(m => { const b = anterior.indicadores.medias.find(v => v.chave === m.chave); return { chave: m.chave, rotulo: m.rotulo, delta: m.media != null && b?.media != null ? arred(m.media - b.media) : null, amostraAtual: m.avaliacoes, amostraAnterior: b?.avaliacoes || 0 }; }),
    participacaoPP: pa != null && pb != null ? arred(pa - pb) : null, temas,
    ressalva: 'Variações são descritivas, não evidência de melhora comprovada. Amostras pequenas limitam conclusões. Temas são alinhados pelo título normalizado; ausência de menção não comprova resolução e títulos distintos não garantem problemas novos.' };
}