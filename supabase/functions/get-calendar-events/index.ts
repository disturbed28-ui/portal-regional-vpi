import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Verifica se o título do evento é restrito (contém "Caveira" em qualquer posição)
function isRestrictedEvent(summary: string | undefined): boolean {
  if (!summary) return false;
  // Match: "Caveira" ou "Caveiras" em qualquer posição como palavra inteira
  return /\bcaveiras?\b/i.test(summary);
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
    const params: URLSearchParams = new URLSearchParams({
      key: apiKey,
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'true', // Incluir eventos cancelados
      ...(pageToken && { pageToken })
    });
    
    const url: string = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response: Response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }
    
    const data: any = await response.json();
    allEvents = allEvents.concat(data.items || []);
    pageToken = data.nextPageToken;
    
    console.log(`[get-calendar-events] Fetched ${data.items?.length || 0} events (total: ${allEvents.length})`);
  } while (pageToken);
  
  return allEvents;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    const CALENDAR_ID = '3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com';
    
    if (!API_KEY) {
      logError('get-calendar-events', 'Google Calendar API Key not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do calendário não disponível' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ========================================
    // 1. Verificar se usuário é Caveira
    // ========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    
    let isCaveiraUser = false;

    if (user?.id) {
      const { data: integrante, error: integranteError } = await supabase
        .from('integrantes_portal')
        .select('caveira, caveira_suplente')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (integranteError) {
        console.error('[get-calendar-events] Erro ao buscar integrante:', integranteError);
      } else if (integrante) {
        isCaveiraUser = integrante.caveira === true || integrante.caveira_suplente === true;
      }
    }

    console.log(`[get-calendar-events] User: ${user?.id || 'anônimo'} | isCaveiraUser: ${isCaveiraUser}`);

    // ========================================
    // 2. Buscar eventos do Google Calendar
    // ========================================
    // Janela: 1 mês passado / 6 meses futuro
    const oneMonthBefore = new Date();
    oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    console.log('[get-calendar-events] Fetching calendar events (1 mês passado / 6 meses futuro)');
    
    const allEvents = await fetchAllEvents(
      CALENDAR_ID,
      API_KEY,
      oneMonthBefore.toISOString(),
      sixMonthsLater.toISOString()
    );

    console.log('[get-calendar-events] Total events fetched:', allEvents.length);

    // ========================================
    // 3. Filtrar eventos restritos "Caveira"
    // ========================================
    const filteredEvents = allEvents.filter(event => {
      const summary = event.summary || '';
      
      // Se é evento restrito e usuário NÃO é caveira, remover
      if (isRestrictedEvent(summary) && !isCaveiraUser) {
        console.log(`[get-calendar-events] 🔒 Evento restrito removido: "${summary}"`);
        return false;
      }
      
      return true;
    });

    const removedCount = allEvents.length - filteredEvents.length;
    if (removedCount > 0) {
      console.log(`[get-calendar-events] Eventos Caveira removidos: ${removedCount}`);
    }

    console.log(`[get-calendar-events] Retornando ${filteredEvents.length} eventos`);

    return new Response(
      JSON.stringify({ items: filteredEvents }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logError('get-calendar-events', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar eventos do calendário' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
