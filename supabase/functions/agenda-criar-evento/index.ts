import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_BASE = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';
const TIMEZONE = 'America/Sao_Paulo';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function gatewayFetch(path: string, init?: RequestInit): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
  if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) {
    throw new Error('Conexão com o Google Agenda não configurada');
  }
  return fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return jsonRes({ error: 'Não autenticado' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: temPermissao } = await supabaseAdmin.rpc('user_has_screen_permission', {
      _user_id: user.id,
      _screen_route: '/agenda/adicionar-evento',
    });
    if (!temPermissao) return jsonRes({ error: 'Sem permissão para adicionar eventos' }, 403);

    const body = await req.json();
    const {
      titulo, tipo, time_especial, escopo, regional_sigla, divisao_nome,
      data_evento, hora_inicio, local, ponto_encontro, contato, descricao,
      flyer_base64, flyer_mime, forcar_duplicidade,
    } = body as Record<string, string | boolean | undefined>;

    if (!titulo || !data_evento) {
      return jsonRes({ error: 'Título e data são obrigatórios' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_evento as string)) {
      return jsonRes({ error: 'Data inválida (use YYYY-MM-DD)' }, 400);
    }

    // 1. Resolver regional pela sigla
    let regionalId: string | null = null;
    const ehComando = String(escopo || '').toLowerCase() === 'comando'
      || String(regional_sigla || '').toUpperCase() === 'CMD';
    if (regional_sigla && !ehComando) {
      const { data: reg } = await supabaseAdmin
        .from('regionais')
        .select('id')
        .ilike('sigla', (regional_sigla as string).trim())
        .maybeSingle();
      regionalId = reg?.id || null;
    }

    // 2. Resolver ou criar divisão
    let divisaoId: string | null = null;
    let divisaoCriada = false;
    if (divisao_nome && regionalId) {
      const nomeNorm = normalizar(`DIVISAO ${divisao_nome} - SP`);
      const { data: divExistente } = await supabaseAdmin
        .from('divisoes')
        .select('id')
        .eq('regional_id', regionalId)
        .or(`nome.eq.${nomeNorm},nome_ascii.eq.${nomeNorm}`)
        .maybeSingle();

      if (divExistente) {
        divisaoId = divExistente.id;
      } else {
        const slug = nomeNorm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: novaDiv, error: divErr } = await supabaseAdmin
          .from('divisoes')
          .insert({ nome: nomeNorm, nome_ascii: nomeNorm, slug, regional_id: regionalId })
          .select('id')
          .single();
        if (divErr) {
          console.error('[agenda-criar-evento] Erro ao criar divisão:', divErr);
          return jsonRes({ error: `Falha ao criar a divisão ${nomeNorm}` }, 500);
        }
        divisaoId = novaDiv.id;
        divisaoCriada = true;
      }
    }

    // 3. Escolher agenda de destino
    const ehTimeEspecial = ['caveira', 'lobo', 'ursinho'].includes((time_especial as string || '').toLowerCase());
    const { data: calendars } = await supabaseAdmin
      .from('agenda_calendars')
      .select('nome, calendar_id')
      .eq('ativo', true);
    const calElite = (calendars || []).find((c: { nome: string }) => /elite/i.test(c.nome));
    const calRegional = (calendars || []).find((c: { nome: string }) => /regional/i.test(c.nome));
    const calDestino = ehTimeEspecial ? calElite : calRegional;
    if (!calDestino) {
      return jsonRes({ error: 'Agenda de destino não encontrada no cadastro de agendas' }, 500);
    }

    // 4. Verificar duplicidade (mesmo dia, título parecido)
    const timeMin = `${data_evento}T00:00:00-03:00`;
    const timeMax = `${data_evento}T23:59:59-03:00`;
    const listResp = await gatewayFetch(
      `/calendars/${encodeURIComponent(calDestino.calendar_id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=50`,
    );
    if (!listResp.ok) {
      const errBody = await listResp.text();
      console.error(`[agenda-criar-evento] Gateway list ${listResp.status}: ${errBody}`);
      return jsonRes({ error: 'Falha ao consultar a agenda', status: listResp.status, details: errBody }, listResp.status);
    }
    const listData = await listResp.json();
    const tituloNorm = normalizar(titulo as string);
    const duplicado = (listData.items || []).find((ev: { summary?: string; status?: string }) =>
      ev.status !== 'cancelled' && ev.summary && normalizar(ev.summary) === tituloNorm,
    );
    if (duplicado && !forcar_duplicidade) {
      return jsonRes({
        duplicado: true,
        mensagem: `Já existe um evento com este título neste dia: "${duplicado.summary}"`,
        evento_existente_id: duplicado.id,
      }, 409);
    }

    // 5. Upload do flyer (se houver) e link assinado de longa duração
    let flyerUrl: string | null = null;
    if (flyer_base64) {
      const mime = (flyer_mime as string) || 'image/jpeg';
      const ext = mime.includes('png') ? 'png' : 'jpg';
      const path = `${data_evento}/${crypto.randomUUID()}.${ext}`;
      const bytes = Uint8Array.from(atob(flyer_base64 as string), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabaseAdmin.storage
        .from('agenda-flyers')
        .upload(path, bytes, { contentType: mime });
      if (upErr) {
        console.error('[agenda-criar-evento] Erro upload flyer:', upErr);
      } else {
        const { data: signed } = await supabaseAdmin.storage
          .from('agenda-flyers')
          .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 ano
        flyerUrl = signed?.signedUrl || null;
      }
    }

    // 6. Montar descrição e criar evento
    const partesDescricao: string[] = [];
    if (descricao) partesDescricao.push(descricao as string);
    if (ponto_encontro) partesDescricao.push(`P.E.: ${ponto_encontro}`);
    if (contato) partesDescricao.push(`Contato: ${contato}`);
    if (tipo) partesDescricao.push(`Tipo: ${tipo}`);
    if (flyerUrl) partesDescricao.push(`Flyer: ${flyerUrl}`);

    const eventoGoogle: Record<string, unknown> = {
      summary: titulo,
      location: (local as string) || undefined,
      description: partesDescricao.join('\n\n') || undefined,
    };
    if (hora_inicio) {
      eventoGoogle.start = { dateTime: `${data_evento}T${hora_inicio}:00-03:00`, timeZone: TIMEZONE };
      eventoGoogle.end = { dateTime: `${data_evento}T${hora_inicio}:00-03:00`, timeZone: TIMEZONE };
    } else {
      // Evento de dia inteiro
      const fim = new Date(`${data_evento}T12:00:00-03:00`);
      fim.setDate(fim.getDate() + 1);
      const fimStr = fim.toISOString().slice(0, 10);
      eventoGoogle.start = { date: data_evento };
      eventoGoogle.end = { date: fimStr };
    }

    const createResp = await gatewayFetch(
      `/calendars/${encodeURIComponent(calDestino.calendar_id)}/events`,
      { method: 'POST', body: JSON.stringify(eventoGoogle) },
    );
    if (!createResp.ok) {
      const errBody = await createResp.text();
      console.error(`[agenda-criar-evento] Gateway create ${createResp.status}: ${errBody}`);
      return jsonRes({ error: 'Falha ao gravar o evento no Google Agenda', status: createResp.status, details: errBody }, createResp.status);
    }
    const eventoCriado = await createResp.json();

    // 7. Registrar autoria
    await supabaseAdmin.from('evento_autoria').insert({
      google_event_id: eventoCriado.id,
      calendar_id: calDestino.calendar_id,
      user_id: user.id,
      divisao_id: divisaoId,
      regional_id: regionalId,
      flyer_url: flyerUrl,
    });

    return jsonRes({
      sucesso: true,
      evento_id: eventoCriado.id,
      agenda: calDestino.nome,
      divisao_criada: divisaoCriada,
      divisao_id: divisaoId,
      regional_id: regionalId,
    });
  } catch (err) {
    console.error('[agenda-criar-evento] Erro:', err);
    return jsonRes({ error: String(err) }, 500);
  }
});
