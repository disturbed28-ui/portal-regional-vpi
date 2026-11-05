import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import type { SnapshotCiclo, AnaliseCiclo, IndicadoresCiclo } from '../_shared/pesquisaCiclos.ts';
import brasaoAsset from './brasao_regional_vp1.png.asset.json' with { type: 'json' };

let brasaoCache: Uint8Array | undefined;
async function lerBrasao() {
  if (brasaoCache) return brasaoCache;
  const resposta = await fetch(new URL(brasaoAsset.url, 'https://vp1.app.br'));
  if (!resposta.ok) throw new Error('Não foi possível carregar o brasão do relatório. Tente novamente.');
  brasaoCache = new Uint8Array(await resposta.arrayBuffer());
  return brasaoCache;
}

// Print tokens, matching the portal's neutral brand palette on white paper.
const tinta = rgb(.067, .09, .13), secundario = rgb(.33, .37, .42), linha = rgb(.75, .78, .8);
export async function gerarPdf(d: SnapshotCiclo, oficial: boolean, nome?: string, versao = 1, brasao?: Uint8Array) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const marca = await doc.embedPng(brasao || await lerBrasao());
  let page = doc.addPage([595.28, 841.89]), y = 750;
  const periodo = `${d.periodo.inicio} a ${d.periodo.fim}`;
  const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, ' ').replace(/[^\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/g, ' ');
  const nova = () => { page = doc.addPage([595.28, 841.89]); y = 750; };
  function texto(s: string, size = 10, forte = false) {
    const font = forte ? bold : regular;
    let atual = '';
    const lines: string[] = [];
    for (const palavra of clean(s).split(/\s+/)) {
      if (font.widthOfTextAtSize(`${atual} ${palavra}`, size) > 499 && atual) { lines.push(atual); atual = ''; }
      // Long unbroken words also wrap, rather than escaping page margins.
      for (const letra of (atual ? ' ' : '') + palavra) {
        if (font.widthOfTextAtSize(atual + letra, size) > 499) { lines.push(atual); atual = ''; }
        atual += letra;
      }
    }
    if (atual) lines.push(atual);
    for (const l of lines) { if (y < 74) nova(); page.drawText(l, { x: 48, y, size, font, color: tinta }); y -= size + 5; }
    y -= 4;
  }
  const secao = (s: string) => { if (y < 145) nova(); y -= 12; texto(s, 13, true); };
  const n = (v: number | null | undefined) => v == null ? '—' : v.toFixed(1).replace('.', ',');
  const ind = (i: IndicadoresCiclo) => {
    texto(`${i.respostas} respostas | Efetivo de referência: ${i.participacao?.integrantesAtivos ?? '—'} | Participação: ${n(i.participacao?.percentual)}%`, 10, true);
    for (const m of i.medias) texto(`${m.rotulo}: ${n(m.media)} / 5 (${m.avaliacoes} avaliações)`);
  };
  const temAnalise = (a: AnaliseCiclo | undefined) => a?.estado === 'ok' || a?.estado === 'desatualizada';
  const avisoAnalise = (a: AnaliseCiclo | undefined) => a?.estado === 'amostra_insuficiente'
    ? 'Amostra insuficiente: análise qualitativa preservada por anonimato.'
    : a?.estado === 'processando' ? 'Análise qualitativa ainda em processamento — gere o relatório novamente em alguns minutos.'
    : 'Análise qualitativa não disponível neste relatório.';
  const temas = (a: AnaliseCiclo | undefined, chave: 'pontosFortes' | 'pontosFracos' | 'sugestoes' | 'boasPraticas') => {
    if (!temAnalise(a)) return;
    if (!a[chave]?.length) texto('Sem temas identificados nesta categoria.');
    for (const t of a[chave] || []) {
      const base = a.respostasIncluidas || 0;
      texto(`${t.tema} — ${t.respostas} de ${base} respostas (${base ? n(t.respostas / base * 100) : '—'}%) · ${t.divisoes} divisões`, 10, true);
      texto(t.resumo);
    }
  };
  texto(oficial ? 'RELATÓRIO OFICIAL — FECHAMENTO DE CICLO' : 'RELATÓRIO GERENCIAL — ACOMPANHAMENTO', 14, true);
  texto(nome || 'Pesquisa de Satisfação', 16, true);
  const regional = d.escopo.regionais.find(r => r.id === d.escopo.regionalId)?.nome || '';
  const divisao = d.escopo.divisoes.find(v => v.id === d.escopo.divisaoId)?.nome;
  texto(`${regional}${divisao ? ' · ' + divisao : ' · Consolidado regional'} | ${periodo}`);
  texto(`Emitido em ${new Date(d.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (São Paulo)${oficial ? ' | Versão ' + versao : ''}`);
  texto('Pesquisa anônima: participação compara respostas ao efetivo, não pessoas únicas identificadas.', 9);
  secao('1. Resumo executivo'); ind(d.indicadores);
  texto(d.analise?.diagnostico || (temAnalise(d.analise) ? 'Diagnóstico não informado.' : avisoAnalise(d.analise)));
  texto(`Análise: ${d.analise?.geradoEm ? new Date(d.analise.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'não disponível'} | Referência: ${d.versaoAnalise}`, 9);
  if (d.analise?.estado === 'desatualizada') texto('Observação: análise qualitativa baseada na leitura anterior; uma atualização está em andamento.', 9);
  if (temAnalise(d.analise)) {
    secao('2. Pontos fortes'); temas(d.analise, 'pontosFortes');
    texto('Boas práticas', 11, true); temas(d.analise, 'boasPraticas');
    secao('3. Pontos fracos'); temas(d.analise, 'pontosFracos');
    texto('Sugestões de melhoria', 11, true); temas(d.analise, 'sugestoes');
  } else { secao('2–3. Análise qualitativa'); texto(avisoAnalise(d.analise)); }
  texto('Atividades sugeridas', 11, true);
  for (const a of d.indicadores.atividades) texto(`${a.rotulo}: ${a.quantidade} (${n(a.percentual)}%)`);
  if (d.divisoes?.length) {
    secao('4. Panorama das divisões');
    for (const v of d.divisoes) {
      if (y < 180) nova(); texto(v.nome, 12, true); ind(v.indicadores);
      if (temAnalise(v.analise)) {
        for (const [titulo, chave] of [['Pontos fortes', 'pontosFortes'], ['Pontos fracos', 'pontosFracos'], ['Sugestões', 'sugestoes']] as const) {
          texto(titulo, 10, true);
          const resumida = { ...v.analise, [chave]: v.analise[chave]?.slice(0, 2) };
          temas(resumida, chave);
        }
      } else texto(avisoAnalise(v.analise));
    }
  }
  secao('5. Recomendações e pauta de reunião');
  for (const r of d.analise?.recomendacoes || []) texto(r);
  if (!d.analise?.recomendacoes?.length) texto(temAnalise(d.analise) ? 'Sem recomendações registradas.' : avisoAnalise(d.analise));
  texto('Decisões: __________________________________________________________');
  texto('Responsáveis: _______________________________________________________');
  texto('Prazos: ____________________________________________________________');
  if (oficial && d.comparacao) {
    secao('6. Evolução histórica');
    texto(`Ciclo anterior: ${d.comparacao.periodoAnterior.inicio} a ${d.comparacao.periodoAnterior.fim}`);
    for (const m of d.comparacao.indicadores) texto(`${m.rotulo}: ${n(m.delta)} pontos | amostras ${m.amostraAnterior} → ${m.amostraAtual}`);
    texto(`Participação: ${n(d.comparacao.participacaoPP)} pontos percentuais`);
    for (const t of d.comparacao.temas) texto(`${t.tema}: ${n(t.percentualAnterior)}% (${t.mencoesAnterior}/${t.amostraAnterior}) → ${n(t.percentualAtual)}% (${t.mencoesAtual}/${t.amostraAtual}) · ${t.estado}`);
    texto(d.comparacao.ressalva, 9);
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (marca) { const size = marca.scaleToFit(280, 280); p.drawImage(marca, { x: (595.28 - size.width) / 2, y: 300, ...size, opacity: .045 }); }
    p.drawText('PORTAL REGIONAL VP1 | PESQUISA DE SATISFAÇÃO', { x: 48, y: 800, size: 9, font: bold, color: secundario });
    p.drawLine({ start: { x: 48, y: 785 }, end: { x: 547, y: 785 }, thickness: .6, color: linha });
    p.drawText(`${periodo} | ${oficial ? 'Oficial' : 'Acompanhamento'} | ${i + 1}/${pages.length}`, { x: 48, y: 38, size: 9, font: regular, color: secundario });
  });
  doc.setTitle(oficial ? `Fechamento — ${nome}` : 'Pesquisa de Satisfação — Relatório Gerencial');
  return await doc.save();
}