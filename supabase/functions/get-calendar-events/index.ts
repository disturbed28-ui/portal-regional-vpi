import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';

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

    // Calcular período de 3 meses
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const params = new URLSearchParams({
      key: API_KEY,
      timeMin: now.toISOString(),
      timeMax: threeMonthsLater.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100'
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
    
    console.log('[get-calendar-events] Fetching calendar events');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      logError('get-calendar-events', `Google API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar eventos do calendário' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    console.log('[get-calendar-events] Successfully fetched', data.items?.length || 0, 'events');

    return new Response(
      JSON.stringify(data),
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
