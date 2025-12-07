import { supabase } from "@/integrations/supabase/client";

const CALENDAR_ID = "3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com";

function removeSpecialCharacters(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .replace(/Ç/g, 'C');
}

// Interface para componentes parseados do evento
interface ParsedEvent {
  tipoEvento: string;        // "Acao Social", "PUB", "Reuniao"
  subtipo?: string;          // "Arrecadacao", "Entrega de Coletes"
  divisao: string;           // "Div Cacapava - SP", "CMD V e XX"
  divisaoId: string | null;  // UUID da divisão no banco
  informacoesExtras?: string;// "Casa do irmao Vinicius"
  isCMD: boolean;            // true se for evento do CMD
  isRegional: boolean;       // true se for evento Regional
}

export interface CalendarEvent {
  id: string;
  title: string;
  originalTitle: string;
  normalizedComponents?: ParsedEvent;
  description: string;
  start: string;
  end: string;
  location?: string;
  type: string;
  division: string;
  divisao_id: string | null;
  htmlLink: string;
  isComandoEvent: boolean;
  isRegionalEvent: boolean;
  googleStatus?: string; // Status do evento no Google (cancelled, confirmed, etc.)
}

// Cache de divisões do banco
let divisoesCache: Array<{ id: string; nome: string; normalizado: string }> | null = null;

// Carregar divisões do banco e cachear
async function loadDivisoesCache() {
  if (divisoesCache) return divisoesCache;
  
  console.log('[loadDivisoesCache] Carregando divisões do banco...');
  const { data, error } = await supabase
    .from('divisoes')
    .select('id, nome');
  
  if (error) {
    console.error('[loadDivisoesCache] Erro ao carregar divisões:', error);
    return [];
  }
  
  divisoesCache = (data || []).map(d => ({
    id: d.id,
    nome: d.nome,
    normalizado: removeSpecialCharacters(d.nome).toUpperCase()
  }));
  
  console.log('[loadDivisoesCache] Carregadas', divisoesCache.length, 'divisões');
  return divisoesCache;
}

// Fazer matching fuzzy de divisão com banco
async function matchDivisaoToId(divisaoText: string): Promise<string | null> {
  const divisoes = await loadDivisoesCache();
  const normalizado = removeSpecialCharacters(divisaoText).toUpperCase();
  
  console.log('[matchDivisaoToId] Tentando match para:', divisaoText, '→', normalizado);
  
  // 1. Match exato
  for (const div of divisoes) {
    if (div.normalizado === normalizado) {
      console.log('[matchDivisaoToId] ✅ Match exato:', div.nome);
      return div.id;
    }
  }
  
  // 2. Match por contains (divisão contém o texto ou vice-versa)
  for (const div of divisoes) {
    if (div.normalizado.includes(normalizado) || normalizado.includes(div.normalizado)) {
      console.log('[matchDivisaoToId] ✅ Match parcial:', div.nome);
      return div.id;
    }
  }
  
  // 3. Match por palavras-chave específicas
  const keywords: Record<string, string[]> = {
    'CACAPAVA': ['CACAPAVA', 'CAÇAPAVA', 'CACAPAVA'],
    'JACAREI NORTE': ['JAC NORTE', 'JACAREI NORTE', 'JAC. NORTE', 'JACNORTE', 'NORTE JACAREI'],
    'JACAREI OESTE': ['JAC OESTE', 'JACAREI OESTE', 'JAC. OESTE', 'JACOESTE', 'OESTE JACAREI'],
    'JACAREI LESTE': ['JAC LESTE', 'JACAREI LESTE', 'JAC. LESTE', 'JACLESTE', 'LESTE JACAREI'],
    'JACAREI SUL': ['JAC SUL', 'JACAREI SUL', 'JAC. SUL', 'JACSUL', 'SUL JACAREI'],
    'JACAREI CENTRO': ['JAC CENTRO', 'JACAREI CENTRO', 'JAC. CENTRO', 'CENTRO JACAREI', 'CENTRO JAC'],
    'SAO JOSE DOS CAMPOS CENTRO': ['SJC CENTRO', 'SJCCENTRO', 'CENTRO SJC', 'SAO JOSE CENTRO'],
    'SAO JOSE DOS CAMPOS LESTE': ['SJC LESTE', 'SJCLESTE', 'LESTE SJC', 'DIV LESTE', 'SAO JOSE LESTE'],
    'SAO JOSE DOS CAMPOS NORTE': ['SJC NORTE', 'SJCNORTE', 'NORTE SJC', 'SAO JOSE NORTE'],
    'SAO JOSE DOS CAMPOS SUL': ['SJC SUL', 'SJCSUL', 'SUL SJC', 'SAO JOSE SUL'],
    'SAO JOSE DOS CAMPOS EXTREMO SUL': ['EXT SUL', 'EXTSUL', 'EXT. SUL SJC', 'EXTREMO SUL', 'EXT. SUL'],
    'SAO JOSE DOS CAMPOS EXTREMO NORTE': ['EXT NORTE', 'EXTNORTE', 'EXT. NORTE SJC', 'EXTREMO NORTE', 'EXT. NORTE'],
    'SAO JOSE DOS CAMPOS EXTREMO LESTE': ['EXT LESTE', 'EXTLESTE', 'EXT. LESTE SJC', 'EXTREMO LESTE', 'EXT. LESTE'],
    'SAO JOSE DOS CAMPOS OESTE': ['SJC OESTE', 'SJCOESTE', 'OESTE SJC', 'OESTE SAO JOSE', 'SAO JOSE OESTE']
  };
  
  for (const div of divisoes) {
    const divNormalizada = div.normalizado;
    
    for (const [key, patterns] of Object.entries(keywords)) {
      if (divNormalizada.includes(key)) {
        for (const pattern of patterns) {
          if (normalizado.includes(pattern)) {
            console.log('[matchDivisaoToId] ✅ Match por keyword:', div.nome, '(pattern:', pattern, ')');
            return div.id;
          }
        }
      }
    }
  }
  
  console.log('[matchDivisaoToId] ❌ Nenhum match encontrado para:', divisaoText);
  return null;
}

// Parsear componentes do título do evento
function parseEventComponents(originalTitle: string): ParsedEvent {
  const normalized = removeSpecialCharacters(originalTitle);
  const lower = normalized.toLowerCase();
  const upper = normalized.toUpperCase();
  
  console.log('[parseEventComponents] ===== INÍCIO DO PARSING =====');
  console.log('[parseEventComponents] Original:', originalTitle);
  console.log('[parseEventComponents] Normalized:', normalized);
  
  // Detectar se é CMD ou Regional
  const isCMD = upper.includes('CMD');
  const isRegional = upper.includes('REGIONAL');
  console.log('[parseEventComponents] É CMD?', isCMD);
  console.log('[parseEventComponents] É Regional?', isRegional);
  
  // Detectar tipo de evento (prioridade)
  let tipoEvento = 'Outros';
  let subtipo: string | undefined;
  
  // PUB tem prioridade
  if (lower.includes('pub')) {
    tipoEvento = 'PUB';
  }
  // Ação Social / Arrecadação
  else if (lower.includes('acao social') || lower.includes('arrecadacao')) {
    tipoEvento = 'Acao Social';
    if (lower.includes('arrecadacao')) {
      subtipo = 'Arrecadacao';
    }
  }
  // Bate e Volta (antes de reunião para não confundir com bate-papo)
  else if (lower.includes('bate e volta')) {
    tipoEvento = 'Bate e Volta';
  }
  // Reunião (incluindo bate-papo)
  else if (lower.includes('reuniao') || lower.includes('bate papo') || lower.includes('bate-papo')) {
    tipoEvento = 'Reuniao';
  }
  // Bonde Insano
  else if (lower.includes('bonde insano') || lower.includes('bonde')) {
    tipoEvento = 'Bonde Insano';
  }
  
  console.log('[parseEventComponents] Tipo detectado:', tipoEvento);
  
  // Detectar subtipos específicos
  if (lower.includes('entrega de coletes')) {
    subtipo = 'Entrega de Coletes';
  }
  
  if (subtipo) {
    console.log('[parseEventComponents] Subtipo detectado:', subtipo);
  }
  
  // Detectar divisão e informações extras
  let divisao = 'Sem Divisao';
  let informacoesExtras: string | undefined;
  
  // Se for CMD ou Regional, usar título original como informações extras
  if (isCMD) {
    divisao = 'CMD';
    
    // Usar o título completo como informações extras, removendo apenas tipo de evento
    let tituloParaExtras = originalTitle;
    
    // Remover tipo de evento do início
    if (lower.includes('pub')) {
      tituloParaExtras = originalTitle.replace(/pub\s*[-\s]*/gi, '').trim();
    }
    if (lower.includes('reuniao')) {
      tituloParaExtras = originalTitle.replace(/reuniao\s*[-\s]*/gi, '').trim();
    }
    if (lower.includes('acao social')) {
      tituloParaExtras = originalTitle.replace(/acao\s+social\s*[-\s]*/gi, '').trim();
    }
    
    // Remover "CMD" e parênteses do início/fim
    tituloParaExtras = tituloParaExtras
      .replace(/cmd\s*[-\s]*/gi, '')
      .replace(/^\(+/, '')
      .replace(/\)+$/, '')
      .trim();
    
    if (tituloParaExtras.length > 0) {
      informacoesExtras = tituloParaExtras;
    }
  } else if (isRegional) {
    // Para eventos Regionais, manter o texto completo
    divisao = 'Regional';
    
    // Usar o título completo como informações extras, removendo apenas tipo de evento
    let tituloParaExtras = originalTitle;
    
    // Remover tipo de evento do início
    if (lower.includes('pub')) {
      tituloParaExtras = originalTitle.replace(/pub\s*[-\s]*/gi, '').trim();
    }
    if (lower.includes('reuniao')) {
      tituloParaExtras = originalTitle.replace(/reuniao\s*[-\s]*/gi, '').trim();
    }
    if (lower.includes('acao social')) {
      tituloParaExtras = originalTitle.replace(/acao\s+social\s*[-\s]*/gi, '').trim();
    }
    
    // Remover "Regional" e parênteses/hífens do início/fim
    tituloParaExtras = tituloParaExtras
      .replace(/regional\s*[-\s]*/gi, '')
      .replace(/^\(+/, '')
      .replace(/\)+$/, '')
      .replace(/^[-\s]+/, '')
      .trim();
    
    if (tituloParaExtras.length > 0) {
      informacoesExtras = tituloParaExtras;
    }
  } else {
    // Detectar divisão normal
    divisao = detectDivisionFromTitle(normalized);
    
    // Extrair informações extras (texto após a divisão)
    const divIndex = originalTitle.toLowerCase().indexOf(divisao.toLowerCase());
    if (divIndex > -1 && divIndex + divisao.length < originalTitle.length) {
      const extras = originalTitle.substring(divIndex + divisao.length).trim();
      if (extras && extras.length > 0 && !extras.startsWith('-')) {
        informacoesExtras = extras.replace(/^[-\s]+/, '').trim();
      }
    }
  }
  
  console.log('[parseEventComponents] Divisão detectada:', divisao);
  
  if (informacoesExtras) {
    console.log('[parseEventComponents] Informações extras:', informacoesExtras);
  }
  
  const parsed: ParsedEvent = {
    tipoEvento,
    subtipo,
    divisao,
    divisaoId: null, // Será preenchido depois
    informacoesExtras,
    isCMD,
    isRegional
  };
  
  console.log('[parseEventComponents] ===== RESULTADO FINAL =====');
  console.log('[parseEventComponents] Parsed:', JSON.stringify(parsed, null, 2));
  return parsed;
}

// Detectar divisão do título (versão aprimorada)
function detectDivisionFromTitle(title: string): string {
  const lower = title.toLowerCase();
  const normalized = removeSpecialCharacters(lower);
  
  console.log('[detectDivisionFromTitle] Input:', title);
  console.log('[detectDivisionFromTitle] Normalized:', normalized);
  
  // Extrair regiões e cidades separadamente
  const temSjc = normalized.includes('sjc') || normalized.includes('sao jose') || normalized.includes('sao jose dos campos');
  const temJac = normalized.includes('jac') || normalized.includes('jacarei');
  const temCacapava = normalized.includes('cacapava');
  
  // Extrair direção
  const temNorte = normalized.includes('norte');
  const temSul = normalized.includes('sul');
  const temLeste = normalized.includes('leste');
  const temOeste = normalized.includes('oeste');
  const temCentro = normalized.includes('centro');
  const temExtremo = normalized.includes('extremo') || normalized.includes('ext');
  
  // PRIORIDADE MÁXIMA: Extremos de SJC (com ou sem mencionar SJC)
  // Se tem "Ext" + direção, assume SJC por padrão
  if (temExtremo && temSul) return 'Divisao Sao Jose dos Campos Extremo Sul - SP';
  if (temExtremo && temNorte) return 'Divisao Sao Jose dos Campos Extremo Norte - SP';
  if (temExtremo && temLeste) return 'Divisao Sao Jose dos Campos Extremo Leste - SP';
  
  // SJC Direções normais (precisa mencionar SJC)
  if (temSjc && temCentro) return 'Divisao Sao Jose dos Campos Centro - SP';
  if (temSjc && temLeste) return 'Divisao Sao Jose dos Campos Leste - SP';
  if (temSjc && temNorte) return 'Divisao Sao Jose dos Campos Norte - SP';
  if (temSjc && temSul) return 'Divisao Sao Jose dos Campos Sul - SP';
  if (temSjc && temOeste) return 'Divisao Sao Jose dos Campos Oeste - SP';
  
  // Jacareí Direções
  if (temJac && temNorte) return 'Divisao Jacarei Norte - SP';
  if (temJac && temOeste) return 'Divisao Jacarei Oeste - SP';
  if (temJac && temLeste) return 'Divisao Jacarei Leste - SP';
  if (temJac && temSul) return 'Divisao Jacarei Sul - SP';
  if (temJac && temCentro) return 'Divisao Jacarei Centro - SP';
  
  // Caçapava
  if (temCacapava) return 'Divisao Cacapava - SP';
  
  console.log('[detectDivisionFromTitle] Nenhuma divisão detectada');
  return 'Sem Divisao';
}

// Construir título normalizado
function buildNormalizedTitle(components: ParsedEvent): string {
  const parts: string[] = [];
  
  // Tipo principal
  parts.push(components.tipoEvento);
  
  // Subtipo entre parênteses
  if (components.subtipo) {
    parts[0] += ` (${components.subtipo})`;
  }
  
  // Divisão
  if (components.divisao && components.divisao !== 'Sem Divisao') {
    parts.push(components.divisao);
  }
  
  // Informações extras
  if (components.informacoesExtras) {
    parts.push(components.informacoesExtras);
  }
  
  const normalized = parts.join(' - ');
  console.log('[buildNormalizedTitle] Título normalizado:', normalized);
  return normalized;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    console.log('[fetchCalendarEvents] Chamando edge function segura');
    
    const { data, error } = await supabase.functions.invoke('get-calendar-events');

    if (error) {
      console.error('[fetchCalendarEvents] Edge function error:', error);
      throw error;
    }

    if (!data || !data.items) {
      console.warn('[fetchCalendarEvents] Nenhum evento retornado');
      return [];
    }

    console.log('[fetchCalendarEvents] Processando', data.items.length, 'eventos...');

    const events: CalendarEvent[] = [];
    
    for (const item of data.items) {
      const originalTitle = item.summary || "Sem titulo";
      const googleStatus = item.status || 'confirmed'; // Status do Google (confirmed, cancelled, tentative)
      
      // Parsear componentes do título
      const components = parseEventComponents(originalTitle);
      
      // Fazer matching de divisão com banco
      const divisaoId = await matchDivisaoToId(components.divisao);
      components.divisaoId = divisaoId;
      
      // Construir título normalizado
      const normalizedTitle = buildNormalizedTitle(components);
      
      events.push({
        id: item.id,
        title: normalizedTitle,
        originalTitle,
        normalizedComponents: components,
        description: item.description || "",
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        location: item.location,
        type: components.tipoEvento,
        division: components.divisao,
        divisao_id: divisaoId,
        htmlLink: item.htmlLink || '',
        isComandoEvent: components.isCMD,
        isRegionalEvent: components.isRegional,
        googleStatus, // Incluir status do Google
      });
      
      if (!divisaoId && components.divisao !== 'Sem Divisao') {
        console.warn('[fetchCalendarEvents] ⚠️ Divisão não encontrada no banco:', {
          titulo_original: originalTitle,
          divisao_detectada: components.divisao
        });
      }
    }

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
    
    // Buscar todos os eventos que existem no banco (incluindo status)
    const { data: existingEvents, error: fetchError } = await supabase
      .from('eventos_agenda')
      .select('id, evento_id, titulo, data_evento, tipo_evento, divisao_id, status');
    
    if (fetchError) {
      console.error('[syncEventsWithDatabase] Erro ao buscar eventos existentes:', fetchError);
      return;
    }

    if (!existingEvents || existingEvents.length === 0) {
      console.log('[syncEventsWithDatabase] Nenhum evento no banco para sincronizar');
      return;
    }

    // Criar set de IDs do Google Calendar para comparação rápida
    const googleEventIds = new Set(events.map(e => e.id));

    // Para cada evento existente, verificar mudanças e status
    for (const dbEvent of existingEvents) {
      const calendarEvent = events.find(e => e.id === dbEvent.evento_id);
      
      // CENÁRIO 1: Evento NÃO existe mais no Google (foi deletado)
      if (!calendarEvent && !googleEventIds.has(dbEvent.evento_id)) {
        // Só marca como removido se ainda estiver como 'active'
        if (dbEvent.status === 'active' || !dbEvent.status) {
          console.log(`[syncEventsWithDatabase] ⚠️ Evento removido do Google: ${dbEvent.titulo}`);
          const { error: updateError } = await supabase
            .from('eventos_agenda')
            .update({ 
              status: 'removed', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', dbEvent.id);
          
          if (updateError) {
            console.error(`[syncEventsWithDatabase] Erro ao marcar evento como removido:`, updateError);
          } else {
            console.log(`[syncEventsWithDatabase] ✅ Evento marcado como REMOVIDO`);
          }
        }
        continue;
      }

      if (!calendarEvent) continue;

      // CENÁRIO 2: Evento existe no Google com status "cancelled"
      if (calendarEvent.googleStatus === 'cancelled') {
        if (dbEvent.status === 'active' || !dbEvent.status) {
          console.log(`[syncEventsWithDatabase] ⚠️ Evento cancelado no Google: ${dbEvent.titulo}`);
          const { error: updateError } = await supabase
            .from('eventos_agenda')
            .update({ 
              status: 'cancelled', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', dbEvent.id);
          
          if (updateError) {
            console.error(`[syncEventsWithDatabase] Erro ao marcar evento como cancelado:`, updateError);
          } else {
            console.log(`[syncEventsWithDatabase] ✅ Evento marcado como CANCELADO`);
          }
        }
        continue;
      }

      // CENÁRIO 3: Evento ativo - verificar se há mudanças de dados
      const dbDate = new Date(dbEvent.data_evento).toISOString();
      const calendarDate = new Date(calendarEvent.start).toISOString();
      
      const hasChanges = 
        dbEvent.titulo !== calendarEvent.title ||
        dbDate !== calendarDate ||
        dbEvent.tipo_evento !== calendarEvent.type ||
        dbEvent.divisao_id !== calendarEvent.divisao_id;

      if (hasChanges) {
        console.log(`[syncEventsWithDatabase] Atualizando evento ${calendarEvent.title}:`, {
          titulo_antigo: dbEvent.titulo,
          titulo_novo: calendarEvent.title,
          data_antiga: dbDate,
          data_nova: calendarDate,
          tipo_antigo: dbEvent.tipo_evento,
          tipo_novo: calendarEvent.type,
          divisao_id_antiga: dbEvent.divisao_id,
          divisao_id_nova: calendarEvent.divisao_id
        });

        // Atualizar evento no banco (garantir status active)
        const { error: updateError } = await supabase
          .from('eventos_agenda')
          .update({
            titulo: calendarEvent.title,
            data_evento: calendarEvent.start,
            tipo_evento: calendarEvent.type,
            divisao_id: calendarEvent.divisao_id,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('evento_id', calendarEvent.id);

        if (updateError) {
          console.error(`[syncEventsWithDatabase] Erro ao atualizar evento ${calendarEvent.id}:`, updateError);
        } else {
          console.log(`[syncEventsWithDatabase] ✅ Evento atualizado com sucesso`);
        }
      }
    }

    console.log('[syncEventsWithDatabase] Sincronização concluída');
  } catch (error) {
    console.error('[syncEventsWithDatabase] Erro na sincronização:', error);
  }
}

// Funções antigas mantidas para compatibilidade (caso sejam usadas em outros lugares)
function detectEventType(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes("reuniao") || lower.includes("reunião")) return "Reuniao";
  if (lower.includes("acao social") || lower.includes("ação social") || lower.includes("arrecadacao")) return "Acao Social";
  if (lower.includes("pub")) return "Pub";
  if (lower.includes("bonde")) return "Bonde";
  if (lower.includes("bate e volta")) return "Bate e Volta";
  if (lower.includes("treino")) return "Treino";
  
  return "Outros";
}

function detectDivision(title: string): string {
  const lower = title.toLowerCase();
  const divisoes: string[] = [];
  
  const addDivisao = (divisao: string) => {
    if (!divisoes.includes(divisao)) {
      divisoes.push(divisao);
    }
  };
  
  if (lower.includes("ext sul") || lower.includes("extremo sul")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Sul - SP");
  }
  if (lower.includes("ext leste") || lower.includes("extremo leste")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Leste - SP");
  }
  if (lower.includes("ext norte") || lower.includes("extremo norte")) {
    addDivisao("Divisao Sao Jose dos Campos Extremo Norte - SP");
  }
  if ((lower.includes("sjc centro") || lower.includes("centro sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Centro - SP");
  }
  if ((lower.includes("sjc leste") || lower.includes("leste sjc")) && !lower.includes("ext")) {
    addDivisao("Divisao Sao Jose dos Campos Leste - SP");
  }
  if (lower.includes("cacapava") || lower.includes("caçapava")) {
    addDivisao("Divisao Cacapava - SP");
  }
  if (lower.includes("jacarei norte") || lower.includes("jac norte")) {
    addDivisao("Divisao Jacarei Norte - SP");
  }
  if (lower.includes("jacarei oeste") || lower.includes("jac oeste")) {
    addDivisao("Divisao Jacarei Oeste - SP");
  }
  if (lower.includes("jacarei leste") || lower.includes("jac leste")) {
    addDivisao("Divisao Jacarei Leste - SP");
  }
  if (lower.includes("regional")) {
    addDivisao("Regional");
  }
  
  if (divisoes.length > 0) {
    return divisoes.join(" / ");
  }
  
  return "Sem Divisao";
}
