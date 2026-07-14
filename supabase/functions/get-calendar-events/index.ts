import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AgendaCalendar {
  id: string;
  nome: string;
  calendar_id: string;
  ativo: boolean;
  palavras_chave: string[];
  ver_flag_caveira: boolean;
  ver_flag_lobo: boolean;
  ver_flag_ursinho: boolean;
  ver_grau_v_regional: boolean;
}

interface IntegranteInfo {
  caveira: boolean;
  caveira_suplente: boolean;
  lobo: boolean;
  ursinho: boolean;
  grau: string | null;
  regional_id: string | null;
}

// Extrai sigla regional de um título (VP1/VP2/VP3/LN/CMD e variações romanas)
function extractRegionalSiglaFromTitle(title: string): string | null {
  const norm = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const vpArab = norm.match(/\bVP\s*([123])\b/);
  if (vpArab) return `VP${vpArab[1]}`;
  const vpRom = norm.match(/\bVP\s*(III|II|I)\b/);
  if (vpRom) return ({ III: 'VP3', II: 'VP2', I: 'VP1' } as Record<string, string>)[vpRom[1]];
  const valeRom = norm.match(/VALE\s*(?:DO\s*)?PARAIBA\s*(III|II|I)\b/);
  if (valeRom) return ({ III: 'VP3', II: 'VP2', I: 'VP1' } as Record<string, string>)[valeRom[1]];
  const valeArab = norm.match(/VALE\s*(?:DO\s*)?PARAIBA\s*([123])\b/);
  if (valeArab) return `VP${valeArab[1]}`;
  if (/\bLN\b/.test(norm) || /LITORAL\s*NORTE/.test(norm)) return 'LN';
  if (/\bCMD\b/.test(norm)) return 'CMD';
  return null;
}

function titleMatchesKeywords(title: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return false;
  const norm = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return keywords.some(kw => {
    const kwNorm = (kw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!kwNorm) return false;
    // match como palavra inteira (permitindo plural simples)
    const re = new RegExp(`\\b${kwNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    return re.test(norm);
  });
}

async function fetchAllEvents(
  calendarId: string,
  apiKey: string,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  let allEvents: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const params = new URLSearchParams({
      key: apiKey,
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'true',
      ...(pageToken && { pageToken }),
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.error(`[get-calendar-events] Google API ${response.status} for ${calendarId}: ${body}`);
      throw new Error(`Google API error: ${response.status}`);
    }
    const data = await response.json();
    allEvents = allEvents.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allEvents;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    if (!API_KEY) {
      logError('get-calendar-events', 'Google Calendar API Key not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do calendário não disponível' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 1. Identificar usuário e flags
    const { data: { user } } = await supabaseUser.auth.getUser();
    let integrante: IntegranteInfo = {
      caveira: false, caveira_suplente: false, lobo: false, ursinho: false,
      grau: null, regional_id: null,
    };
    if (user?.id) {
      const { data: ip } = await supabaseAdmin
        .from('integrantes_portal')
        .select('caveira, caveira_suplente, lobo, ursinho, grau, regional_id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (ip) {
        integrante = {
          caveira: ip.caveira === true,
          caveira_suplente: ip.caveira_suplente === true,
          lobo: ip.lobo === true,
          ursinho: ip.ursinho === true,
          grau: ip.grau,
          regional_id: ip.regional_id,
        };
      }
    }
    const isGrauV = (integrante.grau || '').trim().toUpperCase() === 'V';

    // 2. Mapa regional_id -> sigla (para regra Grau V)
    const { data: regionaisData } = await supabaseAdmin
      .from('regionais')
      .select('id, sigla');
    const siglaByRegionalId = new Map<string, string>();
    (regionaisData || []).forEach((r: any) => {
      if (r.sigla) siglaByRegionalId.set(r.id, r.sigla.toUpperCase());
    });
    const userRegionalSigla = integrante.regional_id
      ? siglaByRegionalId.get(integrante.regional_id) || null
      : null;

    // 3. Carregar agendas ativas
    const { data: calendarsData, error: calErr } = await supabaseAdmin
      .from('agenda_calendars')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (calErr) {
      logError('get-calendar-events', calErr);
    }
    const calendars: AgendaCalendar[] = (calendarsData as any) || [];

    if (calendars.length === 0) {
      console.log('[get-calendar-events] Nenhuma agenda cadastrada.');
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Janela temporal
    const now = new Date();
    const monthsBefore = new Date(now); monthsBefore.setMonth(monthsBefore.getMonth() - 2);
    const monthsAfter = new Date(now); monthsAfter.setMonth(monthsAfter.getMonth() + 6);
    const timeMin = monthsBefore.toISOString();
    const timeMax = monthsAfter.toISOString();

    // 5. Buscar eventos em paralelo, aplicando regras de restrição por calendário
    const perCalendarResults = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const events = await fetchAllEvents(cal.calendar_id, API_KEY, timeMin, timeMax);
          const filtered = events.filter((event) => {
            const title = event.summary || '';
            const isRestricted = titleMatchesKeywords(title, cal.palavras_chave);
            if (!isRestricted) return true;

            // Aplicar regras de visibilidade
            if (cal.ver_flag_caveira && (integrante.caveira || integrante.caveira_suplente)) return true;
            if (cal.ver_flag_lobo && integrante.lobo) return true;
            if (cal.ver_flag_ursinho && integrante.ursinho) return true;
            if (cal.ver_grau_v_regional && isGrauV && userRegionalSigla) {
              const eventSigla = extractRegionalSiglaFromTitle(title);
              if (eventSigla && eventSigla === userRegionalSigla) return true;
            }
            return false;
          });
          console.log(`[get-calendar-events] "${cal.nome}": ${events.length} → ${filtered.length} eventos`);
          return filtered;
        } catch (err) {
          console.error(`[get-calendar-events] Falha ao buscar agenda "${cal.nome}":`, err);
          return [];
        }
      })
    );

    // 6. Mesclar e deduplicar por event.id (evita duplicatas se o mesmo evento
    //    aparecer em dois calendários por engano)
    const merged: any[] = [];
    const seen = new Set<string>();
    for (const list of perCalendarResults) {
      for (const ev of list) {
        if (ev.id && !seen.has(ev.id)) {
          seen.add(ev.id);
          merged.push(ev);
        }
      }
    }

    console.log(`[get-calendar-events] Total mesclado: ${merged.length} eventos (${calendars.length} agendas)`);

    return new Response(JSON.stringify({ items: merged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError('get-calendar-events', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar eventos do calendário' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
