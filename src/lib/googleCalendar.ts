import { supabase } from "@/integrations/supabase/client";

const CALENDAR_ID = "3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com";

function removeSpecialCharacters(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .replace(/Ç/g, 'C');
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location?: string;
  type: string;
  division: string;
  htmlLink: string;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    console.log('[fetchCalendarEvents] Chamando edge function segura');
    
    // Chamar edge function segura ao invés de fazer requisição direta
    const { data, error } = await supabase.functions.invoke('get-calendar-events');

    if (error) {
      console.error('[fetchCalendarEvents] Edge function error:', error);
      throw error;
    }

    if (!data || !data.items) {
      console.warn('[fetchCalendarEvents] Nenhum evento retornado');
      return [];
    }

    const events = data.items.map((item: any) => {
      const normalizedTitle = removeSpecialCharacters(item.summary || "Sem titulo");
      
      return {
        id: item.id,
        title: normalizedTitle,
        description: item.description || "",
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        location: item.location,
        type: detectEventType(normalizedTitle),
        division: detectDivision(normalizedTitle),
        htmlLink: item.htmlLink || '',
      };
    });

    console.log('[fetchCalendarEvents] Processados', events.length, 'eventos');

    // Sincronizar eventos que já existem no banco de dados
    await syncEventsWithDatabase(events);

    return events;
  } catch (error) {
    console.error('[fetchCalendarEvents] Erro:', error);
    throw new Error("Erro ao buscar eventos do calendário");
  }
}

async function syncEventsWithDatabase(events: CalendarEvent[]) {
  try {
    console.log('[syncEventsWithDatabase] Iniciando sincronização de eventos...');
    
    // Buscar todos os eventos que existem no banco
    const { data: existingEvents, error: fetchError } = await supabase
      .from('eventos_agenda')
      .select('evento_id, titulo, data_evento, tipo_evento');
    
    if (fetchError) {
      console.error('[syncEventsWithDatabase] Erro ao buscar eventos existentes:', fetchError);
      return;
    }

    if (!existingEvents || existingEvents.length === 0) {
      console.log('[syncEventsWithDatabase] Nenhum evento no banco para sincronizar');
      return;
    }

    // Para cada evento existente, verificar se há mudanças
    for (const dbEvent of existingEvents) {
      const calendarEvent = events.find(e => e.id === dbEvent.evento_id);
      
      if (!calendarEvent) {
        console.log(`[syncEventsWithDatabase] Evento ${dbEvent.evento_id} não encontrado no Google Calendar`);
        continue;
      }

      // Verificar se houve mudanças
      const dbDate = new Date(dbEvent.data_evento).toISOString();
      const calendarDate = new Date(calendarEvent.start).toISOString();
      
      const hasChanges = 
        dbEvent.titulo !== calendarEvent.title ||
        dbDate !== calendarDate ||
        dbEvent.tipo_evento !== calendarEvent.type;

      if (hasChanges) {
        console.log(`[syncEventsWithDatabase] Atualizando evento ${calendarEvent.title}:`, {
          titulo_antigo: dbEvent.titulo,
          titulo_novo: calendarEvent.title,
          data_antiga: dbDate,
          data_nova: calendarDate,
          tipo_antigo: dbEvent.tipo_evento,
          tipo_novo: calendarEvent.type
        });

        // Atualizar evento no banco
        const { error: updateError } = await supabase
          .from('eventos_agenda')
          .update({
            titulo: calendarEvent.title,
            data_evento: calendarEvent.start,
            tipo_evento: calendarEvent.type,
            updated_at: new Date().toISOString()
          })
          .eq('evento_id', calendarEvent.id);

        if (updateError) {
          console.error(`[syncEventsWithDatabase] Erro ao atualizar evento ${calendarEvent.id}:`, updateError);
        } else {
          console.log(`[syncEventsWithDatabase] Evento ${calendarEvent.title} atualizado com sucesso`);
        }
      }
    }

    console.log('[syncEventsWithDatabase] Sincronização concluída');
  } catch (error) {
    console.error('[syncEventsWithDatabase] Erro na sincronização:', error);
  }
}

function detectEventType(title: string): string {
  const lower = title.toLowerCase();
  
  // Reunião (várias variações)
  if (lower.includes("reuniao") || lower.includes("reunião")) return "Reuniao";
  
  // Ação Social
  if (lower.includes("acao social") || lower.includes("ação social") || lower.includes("arrecadacao") || lower.includes("arrecadação")) return "Acao Social";
  
  // Outros tipos
  if (lower.includes("pub")) return "Pub";
  if (lower.includes("bonde")) return "Bonde";
  if (lower.includes("bate e volta")) return "Bate e Volta";
  if (lower.includes("treino")) return "Treino";
  
  return "Outros";
}

function detectDivision(title: string): string {
  const lower = title.toLowerCase();
  const divisoes: string[] = [];
  
  // Função auxiliar para adicionar divisão se ainda não foi adicionada
  const addDivisao = (divisao: string) => {
    if (!divisoes.includes(divisao)) {
      divisoes.push(divisao);
    }
  };
  
  // ===== PRIORIDADE: Divisões "Extremo" =====
  // Detectar PRIMEIRO as divisões "extremo" para evitar conflitos
  
  if (lower.includes("ext sul") || lower.includes("ext.sul") || lower.includes("estsul") || 
      lower.includes("ext. sul sjc") || lower.includes("ext sul sjc")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Sul - SP");
  }
  
  if (lower.includes("ext leste") || lower.includes("ext.leste") || lower.includes("estleste") || 
      lower.includes("ext. leste sjc") || lower.includes("ext leste sjc")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Leste - SP");
  }
  
  if (lower.includes("ext norte") || lower.includes("ext.norte") || lower.includes("estnorte") || 
      lower.includes("ext. norte sjc") || lower.includes("ext norte sjc")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Norte - SP");
  }
  
  // ===== Divisões Normais de São José dos Campos =====
  // Adicionar verificação !lower.includes("ext") para evitar conflitos
  
  if ((lower.includes("sjc centro") || lower.includes("sjc.centro") || 
       lower.includes("div. sjc centro") || lower.includes("div.sjc centro") || 
       lower.includes("divesjc centro") || lower.includes("divsjc centro") || 
       lower.includes("centro sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Centro - SP");
  }
  
  if ((lower.includes("sjc leste") || lower.includes("sjc.leste") || 
       lower.includes("div. sjc leste") || lower.includes("div.leste") || 
       lower.includes("div leste") || lower.includes("diveleste") || 
       lower.includes("leste sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Leste - SP");
  }
  
  if ((lower.includes("sjc norte") || lower.includes("sjc.norte") || 
       lower.includes("norte sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Norte - SP");
  }
  
  if ((lower.includes("sjc sul") || lower.includes("sjc.sul") || 
       lower.includes("sul sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Sul - SP");
  }
  
  // Caçapava
  if (lower.includes("cacapava") || lower.includes("caçapava")) {
    addDivisao("Divisao Cacapava - SP");
  }
  
  // Jacareí com suas divisões
  if (lower.includes("jacarei sul") || lower.includes("jac sul") || lower.includes("jac. sul")) {
    addDivisao("Divisao Jacarei Sul - SP");
  }
  if (lower.includes("jacarei norte") || lower.includes("jac norte") || lower.includes("jac. norte")) {
    addDivisao("Divisao Jacarei Norte - SP");
  }
  if (lower.includes("jacarei leste") || lower.includes("jac leste") || lower.includes("jac. leste")) {
    addDivisao("Divisao Jacarei Leste - SP");
  }
  if (lower.includes("jacarei oeste") || lower.includes("jac oeste") || lower.includes("jac. oeste")) {
    addDivisao("Divisao Jacarei Oeste - SP");
  }
  if (lower.includes("jacarei centro") || lower.includes("jac centro") || lower.includes("jac. centro")) {
    addDivisao("Divisao Jacarei Centro - SP");
  }
  if ((lower.includes("jacarei") || lower.includes("jac ")) && divisoes.length === 0) {
    addDivisao("Divisao Jacarei - SP");
  }
  
  if (lower.includes("regional")) {
    addDivisao("Regional");
  }
  
  // Se encontrou divisões, retornar separadas por " / "
  if (divisoes.length > 0) {
    return divisoes.join(" / ");
  }
  
  return "Sem Divisao";
}
