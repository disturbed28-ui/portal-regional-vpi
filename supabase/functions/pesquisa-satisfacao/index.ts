import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { CABECALHO, hierarquiaDasAbas, linhaDaResposta, respostaSchema, type Hierarquia } from './model.ts';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const ESTRUTURA_ID = '1zCMp1nWkqDITH6jpytZdiyB4DxtosDJXCASLcllKSJ8';
// Mutável: se a planilha de respostas for apagada, uma nova é criada e o ID passa a valer nesta instância.
let respostasId = '1MnmWc8Y0Vnnyg3iTkpO0cbQdM3AG7ysDVvxEC2TrZlk';
const ABA = "'Respostas Pesquisa'";
let cache: { dados: Hierarquia; ate: number } | undefined;
let carregando: Promise<Hierarquia> | undefined;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
class ProviderError extends Error {
  constructor(public status: number, public details: string) { super('Não foi possível acessar a planilha.'); }
}
async function gateway(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  const connection = Deno.env.get('GOOGLE_SHEETS_API_KEY');
  if (!key || !connection) throw new Error('Conexão Google Sheets não configurada.');
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: {
    Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json',
  } });
  if (!res.ok) {
    const details = await res.text();
    console.error('Pesquisa: falha na planilha', res.status, details);
    throw new ProviderError(res.status, details);
  }
  return res.json();
}
async function estrutura(): Promise<Hierarquia> {
  if (cache && cache.ate > Date.now()) return cache.dados;
  if (carregando) return carregando;
  carregando = (async () => {
    const result = await gateway(`/spreadsheets/${ESTRUTURA_ID}/values:batchGet?ranges=Comandos!A:B&ranges=Regionais!A:E&ranges=Divisoes!A:F`);
    const dados = hierarquiaDasAbas(result.valueRanges || []);
    if (!dados.comandos.length || !dados.regionais.length || !dados.divisoes.length) throw new Error('Estrutura indisponível. Tente novamente mais tarde.');
    cache = { dados, ate: Date.now() + 300000 };
    return dados;
  })();
  try { return await carregando; } finally { carregando = undefined; }
}

// Intentionally public: no session, member lookup, respondent identity or response logging.
// Only fixed-sheet hierarchy reads and validated append operations are exposed.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Método não permitido.' }, 405);
  try {
    if (req.method === 'GET') return json(await estrutura());
    if (Number(req.headers.get('content-length') || 0) > 180000) return json({ error: 'Respostas muito grandes.' }, 413);
    const text = await req.text();
    if (text.length > 60000) return json({ error: 'Respostas muito grandes.' }, 413);
    let input: unknown;
    try { input = JSON.parse(text); } catch { return json({ error: 'Dados inválidos.' }, 400); }
    const parsed = respostaSchema.safeParse(input);
    if (!parsed.success) return json({ error: 'Verifique a divisão, as quatro notas de 1 a 5, as atividades (até duas; "Outros" exige texto) e as perguntas obrigatórias (até 5000 caracteres).' }, 400);
    const dados = await estrutura();
    let linha: ReturnType<typeof linhaDaResposta>;
    try { linha = linhaDaResposta(parsed.data, dados); } catch { return json({ error: 'Seleção hierárquica inválida.' }, 400); }
    // Planilha limpa (sem títulos): recria o cabeçalho. Planilha apagada (404): cria uma nova.
    let header: { values?: unknown[][] };
    try {
      header = await gateway(`/spreadsheets/${respostasId}/values/${ABA}!A1:AC1`);
    } catch (error) {
      if (!(error instanceof ProviderError) || error.status !== 404) throw error;
      const criada = await gateway('/spreadsheets', {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: 'Respostas - Pesquisa de Satisfação VP1', locale: 'pt_BR' },
          sheets: [{ properties: { title: 'Respostas Pesquisa', gridProperties: { frozenRowCount: 1 } } }],
        }),
      });
      respostasId = criada.spreadsheetId;
      header = { values: [] };
    }
    if (JSON.stringify(header.values?.[0]) !== JSON.stringify(CABECALHO)) {
      // Garante colunas suficientes (A:AC) antes de gravar o cabeçalho ampliado.
      const meta = await gateway(`/spreadsheets/${respostasId}?fields=sheets.properties`);
      const aba = (meta.sheets || []).find((s: any) => s.properties?.title === 'Respostas Pesquisa')?.properties;
      const faltam = aba ? CABECALHO.length - (aba.gridProperties?.columnCount || 0) : 0;
      if (faltam > 0) await gateway(`/spreadsheets/${respostasId}:batchUpdate`, {
        method: 'POST', body: JSON.stringify({ requests: [{ appendDimension: { sheetId: aba.sheetId, dimension: 'COLUMNS', length: faltam } }] }),
      });
      await gateway(`/spreadsheets/${respostasId}/values/${ABA}!A1:AC1?valueInputOption=RAW`, {
        method: 'PUT', body: JSON.stringify({ values: [CABECALHO] }),
      });
    }
    const result = await gateway(`/spreadsheets/${respostasId}/values/${ABA}!A:AC:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST', body: JSON.stringify({ values: [linha] }),
    });
    if (result.updates?.updatedRows !== 1) return json({ error: 'Não foi possível confirmar o envio. Não reenvie antes de verificar.' }, 502);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ProviderError) return json({ error: error.message, status: error.status, details: error.details }, error.status);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a pesquisa.' }, 500);
  }
});