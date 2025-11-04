import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';

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

    // Calcular período de 6 meses (3 passados + 3 futuros)
    const now = new Date();
    const threeMonthsBefore = new Date();
    threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    console.log('[get-calendar-events] Fetching calendar events with pagination');
    
    // Buscar TODOS os eventos do período usando paginação
    const allEvents = await fetchAllEvents(
      CALENDAR_ID,
      API_KEY,
      threeMonthsBefore.toISOString(),
      threeMonthsLater.toISOString()
    );

    console.log('[get-calendar-events] Total events fetched:', allEvents.length);

    return new Response(
      JSON.stringify({ items: allEvents }),
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
