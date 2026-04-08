import { supabase } from "@/integrations/supabase/client";

const CALENDAR_ID = "3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07@group.calendar.google.com";

function removeSpecialCharacters(text: string): string {
  return text
    // Normalizar para forma decomposta (NFD) primeiro
    .normalize('NFD')
    // Remover marcas diacríticas (acentos, til, etc.)
    .replace(/[\u0300-\u036f]/g, '')
    // Casos especiais que podem não ser cobertos por NFD (encoding diferente)
    .replace(/[ãâáàäª]/gi, 'a')
    .replace(/[êéèë]/gi, 'e')
    .replace(/[îíìï]/gi, 'i')
    .replace(/[ôóòöõº]/gi, 'o')
    .replace(/[ûúùü]/gi, 'u')
    .replace(/[çć]/gi, 'c')
    .replace(/ñ/gi, 'n');
}

// Interface para componentes parseados do evento
interface ParsedEvent {
  tipoEvento: string;        // "Acao Social", "PUB", "Reuniao", "Caveira"
  subtipo?: string;          // "Arrecadacao", "Entrega de Coletes"
  divisao: string;           // "Div Cacapava - SP", "CMD V e XX"
  divisaoId: string | null;  // UUID da divisão no banco
  regionalSigla: string | null; // Sigla da regional (VP1, VP2, LN, CMD)
  informacoesExtras?: string;// "Casa do irmao Vinicius"
  isCMD: boolean;            // true se for evento do CMD
  isRegional: boolean;       // true se for evento Regional
  isCaveira: boolean;        // true se for evento restrito Caveira
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
  isCaveiraEvent: boolean; // Evento restrito para membros Caveira
  googleStatus?: string; // Status do evento no Google (cancelled, confirmed, etc.)
}

// Cache de divisões do banco (enriquecido com sigla da regional)
let divisoesCache: Array<{ 
  id: string; 
  nome: string; 
  normalizado: string;
  regional_id: string | null;
  regionalSigla: string | null;
}> | null = null;

// Carregar divisões do banco e cachear (com sigla da regional)
async function loadDivisoesCache() {
  if (divisoesCache) return divisoesCache;
  
  const { data, error } = await supabase
    .from('divisoes')
    .select(`
      id, 
      nome, 
      regional_id,
      regionais:regional_id(id, sigla)
    `);
  
  if (error) {
    console.error('[loadDivisoesCache] Erro ao carregar divisões:', error);
    return [];
  }
  
  divisoesCache = (data || []).map(d => ({
    id: d.id,
    nome: d.nome,
    normalizado: removeSpecialCharacters(d.nome).toUpperCase(),
    regional_id: d.regional_id,
    regionalSigla: (d.regionais as any)?.sigla || null
  }));
  
  return divisoesCache;
}

// Fazer matching fuzzy de divisão com banco - retorna id E sigla da regional
async function matchDivisaoToId(divisaoText: string): Promise<{ id: string | null; regionalSigla: string | null }> {
  const divisoes = await loadDivisoesCache();
  const normalizado = removeSpecialCharacters(divisaoText).toUpperCase();
  
  // CASO ESPECIAL: "Regional VP1/VP2/VP3/LN"
  const siglaMatch = normalizado.match(/^REGIONAL\s*(VP1|VP2|VP3|LN)$/i);
  if (siglaMatch) {
    const sigla = siglaMatch[1].toUpperCase();
    const siglaToNome: Record<string, string> = {
      'VP1': 'REGIONAL VALE DO PARAIBA I',
      'VP2': 'REGIONAL VALE DO PARAIBA II', 
      'VP3': 'REGIONAL VALE DO PARAIBA III',
      'LN': 'REGIONAL LITORAL NORTE'
    };
    const nomeBuscado = siglaToNome[sigla];
    
    if (nomeBuscado) {
      for (const div of divisoes) {
        if (div.normalizado.includes(nomeBuscado)) {
          return { id: div.id, regionalSigla: sigla };
        }
      }
    }
    return { id: null, regionalSigla: sigla };
  }
  
  // 1. Match exato
  for (const div of divisoes) {
    if (div.normalizado === normalizado) {
      return { id: div.id, regionalSigla: div.regionalSigla };
    }
  }
  
  // 2. Match por contains
  for (const div of divisoes) {
    if (div.normalizado.includes(normalizado) || normalizado.includes(div.normalizado)) {
      return { id: div.id, regionalSigla: div.regionalSigla };
    }
  }
  
  // 3. Match por palavras-chave
  const keywords: Record<string, string[]> = {
    'CACAPAVA': ['CACAPAVA', 'CAÇAPAVA'],
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
            return { id: div.id, regionalSigla: div.regionalSigla };
          }
        }
      }
    }
  }
  
  return { id: null, regionalSigla: null };
}

// Detectar sigla de regional no título original (VP1, VP2, VP3, LN ou numerais romanos)
// Suporta todas as variações: VP1, vp1, VP 1, VPI, vpi, VP I, vp i, VPIII, etc.
function detectRegionalSiglaFromTitle(title: string): string | null {
  // Normalizar título para comparação (sem acentos, uppercase)
  const normalizado = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // 1. Buscar VP + número arábico (com ou sem espaço): VP1, VP 1, vp1, vp 1
  const vpArabicoMatch = normalizado.match(/\bVP\s*([123])\b/);
  if (vpArabicoMatch) {
    return `VP${vpArabicoMatch[1]}`;
  }
  
  // 2. Buscar VP + número romano COLADO ou com espaço: VPI, VPII, VPIII, VP I, VP II, VP III
  // IMPORTANTE: Testar III antes de II antes de I (para não capturar só o primeiro I de III)
  const vpRomanoMatch = normalizado.match(/\bVP\s*(III|II|I)\b/);
  if (vpRomanoMatch) {
    const mapa: Record<string, string> = { 'III': 'VP3', 'II': 'VP2', 'I': 'VP1' };
    return mapa[vpRomanoMatch[1]];
  }
  
  // 3. Buscar "Vale do Paraíba" + número romano
  const valeRomanoMatch = normalizado.match(/VALE\s*(?:DO\s*)?PARAIBA\s*(III|II|I)\b/);
  if (valeRomanoMatch) {
    const mapa: Record<string, string> = { 'III': 'VP3', 'II': 'VP2', 'I': 'VP1' };
    return mapa[valeRomanoMatch[1]];
  }
  
  // 4. Buscar "Vale do Paraíba" + número arábico
  const valeArabicoMatch = normalizado.match(/VALE\s*(?:DO\s*)?PARAIBA\s*([123])\b/);
  if (valeArabicoMatch) {
    return `VP${valeArabicoMatch[1]}`;
  }
  
  // 5. Litoral Norte: LN, ln, Litoral Norte
  if (/\bLN\b/.test(normalizado) || /LITORAL\s*NORTE/.test(normalizado)) {
    return 'LN';
  }
  
  // 6. CMD
  if (/\bCMD\b/.test(normalizado)) {
    return 'CMD';
  }
  
  return null;
}

// Parsear componentes do título do evento
async function parseEventComponents(originalTitle: string): Promise<ParsedEvent> {
  const normalized = removeSpecialCharacters(originalTitle);
  const lower = normalized.toLowerCase();
  const upper = normalized.toUpperCase();
  
  const isCMD = upper.includes('CMD');
  const isRegional = upper.includes('REGIONAL');
  const isCaveira = /\bcaveiras?\b/i.test(originalTitle);
  
  // Detectar tipo de evento
  let tipoEvento = 'Outros';
  let subtipo: string | undefined;
  
  if (isCaveira) {
    tipoEvento = 'Caveira';
  } else if (lower.includes('pub')) {
    tipoEvento = 'PUB';
  } else if (lower.includes('acao social') || lower.includes('arrecadacao')) {
    tipoEvento = 'Acao Social';
    if (lower.includes('arrecadacao')) subtipo = 'Arrecadacao';
  } else if (lower.includes('bate e volta') || lower.includes('bate-volta') || lower.includes('bate volta')) {
    tipoEvento = 'Bate e Volta';
  } else if (
    lower.includes('reuniao') || lower.includes('reunia') ||
    /reuni[aã]o/i.test(originalTitle) || /reuni[aã]/i.test(normalized) ||
    lower.includes('bate papo') || lower.includes('bate-papo')
  ) {
    tipoEvento = 'Reuniao';
  } else if (lower.includes('bonde insano') || lower.includes('bonde') || lower.includes('viagem insana')) {
    tipoEvento = 'Bonde Insano';
  }
  
  if (lower.includes('entrega de coletes')) subtipo = 'Entrega de Coletes';
  
  let divisao = 'Sem Divisao';
  let informacoesExtras: string | undefined;
  let regionalSiglaDetectada: string | null = null;
  
  if (isCaveira) {
    const siglaMatch = originalTitle.match(/\b(VP1|VP2|VP3|LN|CMD)\b/i);
    regionalSiglaDetectada = siglaMatch ? siglaMatch[1].toUpperCase() : null;
    divisao = regionalSiglaDetectada || 'Sem Divisao';
    
    const tituloSemCaveira = originalTitle
      .replace(/\bcaveiras?\b/gi, '')
      .replace(/\b(VP1|VP2|VP3|LN|CMD)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[-:–]\s*/, '')
      .replace(/\s*[-:–]\s*$/, '')
      .trim();
    if (tituloSemCaveira) informacoesExtras = tituloSemCaveira;
  } else if (isCMD) {
    divisao = 'CMD';
    let tituloParaExtras = originalTitle;
    if (lower.includes('pub')) tituloParaExtras = originalTitle.replace(/pub\s*[-\s]*/gi, '').trim();
    if (lower.includes('reuniao')) tituloParaExtras = originalTitle.replace(/reuniao\s*[-\s]*/gi, '').trim();
    if (lower.includes('acao social')) tituloParaExtras = originalTitle.replace(/acao\s+social\s*[-\s]*/gi, '').trim();
    tituloParaExtras = tituloParaExtras.replace(/cmd\s*[-\s]*/gi, '').replace(/^\(+/, '').replace(/\)+$/, '').trim();
    if (tituloParaExtras.length > 0) informacoesExtras = tituloParaExtras;
  } else if (isRegional) {
    regionalSiglaDetectada = detectRegionalSiglaFromTitle(originalTitle);
    divisao = regionalSiglaDetectada ? `Regional ${regionalSiglaDetectada}` : 'Regional';
    let tituloParaExtras = originalTitle;
    if (lower.includes('pub')) tituloParaExtras = originalTitle.replace(/pub\s*[-\s]*/gi, '').trim();
    if (lower.includes('reuniao')) tituloParaExtras = originalTitle.replace(/reuniao\s*[-\s]*/gi, '').trim();
    if (lower.includes('acao social')) tituloParaExtras = originalTitle.replace(/acao\s+social\s*[-\s]*/gi, '').trim();
    tituloParaExtras = tituloParaExtras.replace(/regional\s*[-\s]*/gi, '').replace(/^\(+/, '').replace(/\)+$/, '').replace(/^[-\s]+/, '').trim();
    if (tituloParaExtras.length > 0) informacoesExtras = tituloParaExtras;
  } else {
    divisao = await detectDivisionFromTitle(normalized);
    const divIndex = originalTitle.toLowerCase().indexOf(divisao.toLowerCase());
    if (divIndex > -1 && divIndex + divisao.length < originalTitle.length) {
      const extras = originalTitle.substring(divIndex + divisao.length).trim();
      if (extras && extras.length > 0 && !extras.startsWith('-')) {
        informacoesExtras = extras.replace(/^[-\s]+/, '').trim();
      }
    }
  }
  
  return {
    tipoEvento,
    subtipo,
    divisao,
    divisaoId: null,
    regionalSigla: regionalSiglaDetectada,
    informacoesExtras,
    isCMD,
    isRegional,
    isCaveira
  };
}

// Detectar divisão do título (versão aprimorada com fallback dinâmico do banco)
async function detectDivisionFromTitle(title: string): Promise<string> {
  const lower = title.toLowerCase();
  const normalized = removeSpecialCharacters(lower);
  
  // ===== FAST PATH: regras hardcoded para divisões com lógica especial (cidade+direção) =====
  const temSjc = normalized.includes('sjc') || normalized.includes('sao jose') || normalized.includes('sao jose dos campos');
  const temJac = normalized.includes('jac') || normalized.includes('jacarei');
  const temCacapava = normalized.includes('cacapava');
  
  const temNorte = normalized.includes('norte');
  const temSul = normalized.includes('sul');
  const temLeste = normalized.includes('leste');
  const temOeste = normalized.includes('oeste');
  const temCentro = normalized.includes('centro');
  const temExtremo = normalized.includes('extremo') || normalized.includes('ext');
  
  if (temExtremo && temSul) return 'Divisao Sao Jose dos Campos Extremo Sul - SP';
  if (temExtremo && temNorte) return 'Divisao Sao Jose dos Campos Extremo Norte - SP';
  if (temExtremo && temLeste) return 'Divisao Sao Jose dos Campos Extremo Leste - SP';
  
  if (temSjc && temCentro) return 'Divisao Sao Jose dos Campos Centro - SP';
  if (temSjc && temLeste) return 'Divisao Sao Jose dos Campos Leste - SP';
  if (temSjc && temNorte) return 'Divisao Sao Jose dos Campos Norte - SP';
  if (temSjc && temSul) return 'Divisao Sao Jose dos Campos Sul - SP';
  if (temSjc && temOeste) return 'Divisao Sao Jose dos Campos Oeste - SP';
  
  if (temJac && temNorte) return 'Divisao Jacarei Norte - SP';
  if (temJac && temOeste) return 'Divisao Jacarei Oeste - SP';
  if (temJac && temLeste) return 'Divisao Jacarei Leste - SP';
  if (temJac && temSul) return 'Divisao Jacarei Sul - SP';
  if (temJac && temCentro) return 'Divisao Jacarei Centro - SP';
  
  if (temCacapava) return 'Divisao Cacapava - SP';
  
  // ===== FALLBACK DINÂMICO: buscar divisões do banco e tentar match no título =====
  const divisoes = await loadDivisoesCache();
  const normalizedUpper = normalized.toUpperCase();
  
  // Extrair "nome limpo" de cada divisão (sem "DIVISAO " e " - SP") e buscar no título
  // Ordenar por tamanho do nome decrescente para priorizar matches mais específicos
  const candidatos = divisoes
    .map(d => {
      let nomeLimpo = d.normalizado
        .replace(/^DIVISAO\s+/, '')
        .replace(/\s*-\s*SP\s*$/, '')
        .trim();
      return { ...d, nomeLimpo };
    })
    .filter(d => d.nomeLimpo.length > 0)
    .sort((a, b) => b.nomeLimpo.length - a.nomeLimpo.length);
  
  for (const candidato of candidatos) {
    if (normalizedUpper.includes(candidato.nomeLimpo)) {
      // Formatar como "Divisao NomeLimpo - SP" com capitalização adequada
      const nomeFormatado = candidato.nome
        .replace(/^DIVISAO\s+/i, '')
        .replace(/\s*-\s*SP\s*$/i, '')
        .trim();
      const resultado = `Divisao ${nomeFormatado} - SP`;
      return resultado;
    }
  }
  
  return 'Sem Divisao';
}

// Exportar para invalidar cache quando novas divisões forem cadastradas
export function invalidateDivisoesCache() {
  divisoesCache = null;
  console.log('[invalidateDivisoesCache] Cache de divisões invalidado');
}

// Construir título normalizado (com prefixo de sigla da regional)
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
  
  let innerTitle = parts.join(' - ');
  
  // Proteção contra duplicidade: remover prefixo existente se houver
  innerTitle = innerTitle.replace(/^\[[A-Z0-9]+\]\s*/, '');
  
  // Adicionar prefixo da sigla da regional se existir
  if (components.regionalSigla) {
    innerTitle = `[${components.regionalSigla}] ${innerTitle}`;
  }
  
  return innerTitle;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-calendar-events');

    if (error) {
      console.error('[fetchCalendarEvents] Edge function error:', error);
      throw error;
    }

    if (!data || !data.items) {
      return [];
    }

    // Pré-carregar cache de divisões antes do processamento paralelo
    await loadDivisoesCache();

    // Processar todos os eventos em paralelo
    const processedEvents = await Promise.all(
      data.items.map(async (item: any) => {
        const originalTitle = item.summary || "Sem titulo";
        const googleStatus = item.status || 'confirmed';
        
        const components = await parseEventComponents(originalTitle);
        const matchResult = await matchDivisaoToId(components.divisao);
        components.divisaoId = matchResult.id;
        
        if (components.isCaveira && components.regionalSigla) {
          // manter sigla detectada
        } else if (components.isCMD) {
          components.regionalSigla = 'CMD';
        } else if (matchResult.regionalSigla) {
          components.regionalSigla = matchResult.regionalSigla;
        }
        
        const normalizedTitle = buildNormalizedTitle(components);
        
        return {
          id: item.id,
          title: normalizedTitle,
          originalTitle,
          normalizedComponents: components,
          description: item.description || "",
          start: item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00-03:00` : ''),
          end: item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59-03:00` : ''),
          location: item.location,
          type: components.tipoEvento,
          division: components.divisao,
          divisao_id: matchResult.id,
          htmlLink: item.htmlLink || '',
          isComandoEvent: components.isCMD,
          isRegionalEvent: components.isRegional,
          isCaveiraEvent: components.isCaveira,
          googleStatus,
        } as CalendarEvent;
      })
    );

    const allEvents = processedEvents;
    const activeEvents = allEvents.filter(
      e => e.googleStatus !== 'cancelled' && e.originalTitle !== 'Sem titulo'
    );

    console.log('[fetchCalendarEvents] Eventos:', allEvents.length, '| Ativos:', activeEvents.length);

    // Sincronizar em background (não bloquear retorno)
    syncEventsWithDatabase(allEvents).catch(err => 
      console.error('[syncEventsWithDatabase] Erro:', err)
    );

    return activeEvents;
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
