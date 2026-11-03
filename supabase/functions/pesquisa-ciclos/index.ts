import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { compararCiclos, podeFechar, recortarSnapshot, sanitizarSnapshot, type SnapshotCiclo } from '../_shared/pesquisaCiclos.ts';
import { hashDe } from '../pesquisa-satisfacao-relatorio/calculo.ts';
import { gerarPdf } from './pdf.ts';
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const schema = z.object({ acao: z.enum(['gerencial', 'historico', 'visualizar', 'previa', 'fechar']), regionalId: z.string().uuid(), divisaoId: z.string().uuid().nullable().optional(), inicio: mes, fim: mes, nome: z.string().trim().min(1).max(120).optional(), hash: z.string().length(64).optional(), cicloId: z.string().uuid().optional(), versao: z.number().int().positive().optional(), motivo: z.string().trim().min(5).max(1000).optional(), confirmar: z.boolean().optional() }).strict().refine(v => v.inicio <= v.fim);
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const base64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Dados inválidos.' }, 400);
    const p = parsed.data, authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Entre no portal.' }, 401);
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) throw new Error('Serviço indisponível.');
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth.user) return json({ error: 'Sessão inválida.' }, 401);
    const admin = createClient(url, key);
    const leitura = async (inicio: string, fim: string, divisaoId: string | null) => {
      const r = await fetch(`${url}/functions/v1/pesquisa-satisfacao-relatorio`, { method: 'POST', headers: { Authorization: authorization, apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ regionalId: p.regionalId, divisaoId, inicio, fim, fotografia: true }) });
      const d = await r.json();
      if (!r.ok) throw Object.assign(new Error(d.error || 'Não foi possível ler a pesquisa.'), { status: r.status });
      if (d.escopo?.regionalId !== p.regionalId) throw Object.assign(new Error('Regional fora do seu acesso.'), { status: 403 });
      return d;
    };
    // The existing report endpoint remains the authority for all reads, including historical PDFs.
    const atual = await leitura(p.inicio, p.fim, p.divisaoId || null);
    const [{ data: membro }, { data: perm }] = await Promise.all([
      admin.from('integrantes_portal').select('cargo_nome,grau,ativo,regional_id').eq('profile_id', auth.user.id).eq('ativo', true).maybeSingle(),
      admin.rpc('user_has_screen_permission', { _user_id: auth.user.id, _rota: '/relatorios/pesquisa-satisfacao' }),
    ]);
    const fecharPermitido = !!membro && podeFechar(membro.cargo_nome || '', membro.grau || '', membro.ativo === true, membro.regional_id, p.regionalId, perm === true);
    const { data: ciclos, error: listaErro } = await admin.from('pesquisa_ciclos').select('*').eq('regional_id', p.regionalId).order('fim', { ascending: false });
    if (listaErro) throw new Error('Não foi possível consultar os ciclos.');
    const versoesDe = async (id: string) => {
      const { data, error } = await admin.from('pesquisa_ciclo_versoes').select('*').eq('ciclo_id', id).order('versao', { ascending: false });
      if (error) throw new Error('Não foi possível consultar as versões.'); return data || [];
    };
    if (p.acao === 'historico') {
      const lista = [];
      for (const c of ciclos || []) {
        const vs = await versoesDe(c.id), v = vs[0];
        if (!v) continue;
        let d: SnapshotCiclo;
        try { d = recortarSnapshot(v.snapshot as SnapshotCiclo, atual.escopo.divisaoId); } catch { continue; }
        lista.push({ ...c, versao: v.versao, revisadoEm: v.criado_em, versoes: vs.map(v => ({ versao: v.versao, motivo: v.motivo, criadoEm: v.criado_em })), respostas: d.indicadores.respostas, satisfacao: d.indicadores.medias[0]?.media, delta: d.comparacao?.indicadores[0]?.delta ?? null });
      }
      return json({ ciclos: lista, podeFechar: fecharPermitido });
    }
    if (p.acao === 'visualizar') {
      const c = ciclos?.find(c => c.id === p.cicloId);
      if (!c) return json({ error: 'Ciclo não encontrado.' }, 404);
      const vs = await versoesDe(c.id), v = p.versao ? vs.find(v => v.versao === p.versao) : vs[0];
      if (!v) return json({ error: 'Versão não encontrada.' }, 404);
      const d = recortarSnapshot(v.snapshot as SnapshotCiclo, atual.escopo.divisaoId);
      const pdf = atual.escopo.divisaoId ? base64(await gerarPdf(d, true, c.nome, v.versao)) : v.pdf_base64;
      return json({ snapshot: d, pdf, nome: c.nome, versao: v.versao });
    }
    if (p.acao === 'gerencial') {
      const d = sanitizarSnapshot({ ...atual, geradoEm: new Date().toISOString(), versaoAnalise: 'v1' });
      return json({ snapshot: d, pdf: base64(await gerarPdf(d, false)) });
    }
    if (!fecharPermitido) return json({ error: 'Somente o Diretor Regional autorizado pode fechar ou revisar ciclos da sua regional.' }, 403);
    const regional = atual.escopo.divisaoId ? await leitura(p.inicio, p.fim, null) : atual;
    if (regional.escopo.divisaoId) return json({ error: 'O fechamento exige acesso ao consolidado regional.' }, 403);
    const d = sanitizarSnapshot({ ...regional, geradoEm: new Date().toISOString(), versaoAnalise: 'v1' });
    const estados = [regional.analise, ...(regional.divisoes || []).map((v: any) => v.analise)];
    const pendente = estados.some(a => a?.estado === 'processando' || a?.estado === 'desatualizada');
    const hash = await hashDe([regional.hashFonte, d.indicadores, d.analise, d.divisoes, d.minimo]);
    const sobreposto = (ciclos || []).some(c => c.id !== p.cicloId && c.inicio <= p.fim && c.fim >= p.inicio);
    if (p.acao === 'previa') return json({ snapshot: d, hash, pendente, sobreposto });
    if (pendente) return json({ error: 'Aguarde a atualização das análises antes de fechar o ciclo.' }, 409);
    if (!p.nome || !p.confirmar || !p.hash) return json({ error: 'Informe nome e confirme a prévia.' }, 400);
    if (p.hash !== hash) return json({ error: 'Os resultados mudaram. Confira uma nova prévia antes de confirmar.' }, 409);
    if (sobreposto) return json({ error: 'O período se sobrepõe a um ciclo oficial existente.' }, 409);
    const anterior = (ciclos || []).find(c => c.fim < p.inicio);
    if (anterior) { const v = (await versoesDe(anterior.id))[0]; d.comparacao = compararCiclos(d, v?.snapshot as SnapshotCiclo | undefined); }
    const proximaVersao = p.cicloId ? (await versoesDe(p.cicloId))[0]?.versao + 1 : 1;
    const pdf = base64(await gerarPdf(d, true, p.nome, proximaVersao));
    const { data: id, error } = await admin.rpc('pesquisa_registrar_ciclo', { _regional: p.regionalId, _nome: p.nome, _inicio: p.inicio, _fim: p.fim, _autor: auth.user.id, _snapshot: d, _pdf: pdf, _hash: hash, _revisar: p.cicloId || null, _motivo: p.motivo || null });
    if (error) return json({ error: error.message }, 409);
    return json({ id, pdf, snapshot: d });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Erro ao gerar relatório.' }, Number((e as { status?: number })?.status) || 500); }
});