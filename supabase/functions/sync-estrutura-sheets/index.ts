import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const SETTING_KEY = 'google_sheets_estrutura_id';
const ABAS = ['Comandos', 'Regionais', 'Divisoes', 'Info'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'X-Connection-Api-Key': Deno.env.get('GOOGLE_SHEETS_API_KEY')!,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheets [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!Deno.env.get('LOVABLE_API_KEY') || !Deno.env.get('GOOGLE_SHEETS_API_KEY')) {
      return json({ error: 'Conexão Google Sheets não configurada' }, 500);
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Chamada manual (com usuário) exige admin ou comando; chamada agendada vem sem usuário.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (u?.user) {
      const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', u.user.id);
      const ok = (roles || []).some((r: any) => ['admin', 'comando'].includes(r.role));
      if (!ok) return json({ error: 'Sem permissão' }, 403);
    }

    const [{ data: comandos }, { data: regionais }, { data: divisoes }] = await Promise.all([
      admin.from('comandos').select('id,nome').order('nome'),
      admin.from('regionais').select('id,nome,sigla,comando_id').order('nome'),
      admin.from('divisoes').select('id,nome,regional_id').order('nome'),
    ]);
    const cmdMap = new Map((comandos || []).map((c: any) => [c.id, c]));
    const regMap = new Map((regionais || []).map((r: any) => [r.id, r]));

    const linhasCmd = [['comando_id', 'comando'], ...(comandos || []).map((c: any) => [c.id, c.nome])];
    const linhasReg = [
      ['regional_id', 'comando_id', 'comando', 'regional', 'sigla'],
      ...(regionais || []).map((r: any) => [r.id, r.comando_id, cmdMap.get(r.comando_id)?.nome || '', r.nome, r.sigla || '']),
    ];
    const linhasDiv = [
      ['divisao_id', 'regional_id', 'comando', 'regional', 'sigla', 'divisao'],
      ...(divisoes || [])
        .map((d: any) => {
          const r: any = regMap.get(d.regional_id);
          return [d.id, d.regional_id, cmdMap.get(r?.comando_id)?.nome || '', r?.nome || '', r?.sigla || '', d.nome];
        })
        .sort((a, b) => `${a[2]}|${a[3]}|${a[5]}`.localeCompare(`${b[2]}|${b[3]}|${b[5]}`)),
    ];
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const linhasInfo = [['chave', 'valor'], ['atualizado_em', agora], ['origem', 'Portal VP1 - sincronização automática diária']];

    // Planilha: reutiliza a salva ou cria uma nova
    const { data: setting } = await admin.from('system_settings').select('id,valor_texto').eq('chave', SETTING_KEY).maybeSingle();
    let spreadsheetId: string | null = setting?.valor_texto || null;
    if (spreadsheetId) {
      try {
        const meta = await gw(`/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`);
        const existentes = (meta.sheets || []).map((s: any) => s.properties.title);
        const faltam = ABAS.filter((a) => !existentes.includes(a));
        if (faltam.length) {
          await gw(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            body: JSON.stringify({ requests: faltam.map((title) => ({ addSheet: { properties: { title } } })) }),
          });
        }
      } catch (e) {
        if (String(e).includes('[404]')) spreadsheetId = null; else throw e;
      }
    }
    if (!spreadsheetId) {
      const criada = await gw('/spreadsheets', {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: 'Estrutura VP1 - Comandos, Regionais e Divisoes', locale: 'pt_BR' },
          sheets: ABAS.map((title) => ({ properties: { title, gridProperties: { frozenRowCount: 1 } } })),
        }),
      });
      spreadsheetId = criada.spreadsheetId;
      if (setting?.id) {
        await admin.from('system_settings').update({ valor_texto: spreadsheetId }).eq('id', setting.id);
      } else {
        await admin.from('system_settings').insert({
          chave: SETTING_KEY, valor: true, valor_texto: spreadsheetId,
          descricao: 'Planilha Google com a estrutura (comandos/regionais/divisões), sincronizada diariamente',
        });
      }
    }

    await gw(`/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      body: JSON.stringify({ ranges: ABAS.map((a) => `${a}!A:Z`) }),
    });
    await gw(`/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'Comandos!A1', values: linhasCmd },
          { range: 'Regionais!A1', values: linhasReg },
          { range: 'Divisoes!A1', values: linhasDiv },
          { range: 'Info!A1', values: linhasInfo },
        ],
      }),
    });

    return json({
      success: true,
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      totais: { comandos: linhasCmd.length - 1, regionais: linhasReg.length - 1, divisoes: linhasDiv.length - 1 },
      atualizado_em: agora,
    });
  } catch (e) {
    console.error('[sync-estrutura-sheets]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
