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
  
  console.log('[loadDivisoesCache] Carregando divisões do banco com sigla da regional...');
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
  
  console.log('[loadDivisoesCache] Carregadas', divisoesCache.length, 'divisões com siglas');
  return divisoesCache;
}

// Fazer matching fuzzy de divisão com banco - retorna id E sigla da regional
async function matchDivisaoToId(divisaoText: string): Promise<{ id: string | null; regionalSigla: string | null }> {
  const divisoes = await loadDivisoesCache();
  const normalizado = removeSpecialCharacters(divisaoText).toUpperCase();
  
  console.log('[matchDivisaoToId] Tentando match para:', divisaoText, '→', normalizado);
  
  // CASO ESPECIAL: "Regional VP1/VP2/VP3/LN" → buscar a regional correspondente
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
          console.log('[matchDivisaoToId] ✅ Match por sigla regional:', div.nome, '| Sigla:', sigla);
          return { id: div.id, regionalSigla: sigla };
        }
      }
    }
    
    // Se não encontrou no banco, retornar com a sigla mesmo sem ID
    console.log('[matchDivisaoToId] ⚠️ Regional não encontrada no banco, usando sigla:', sigla);
    return { id: null, regionalSigla: sigla };
  }
  
  // 1. Match exato
  for (const div of divisoes) {
    if (div.normalizado === normalizado) {
      console.log('[matchDivisaoToId] ✅ Match exato:', div.nome, '| Sigla:', div.regionalSigla);
      return { id: div.id, regionalSigla: div.regionalSigla };
    }
  }
  
  // 2. Match por contains (divisão contém o texto ou vice-versa)
  for (const div of divisoes) {
    if (div.normalizado.includes(normalizado) || normalizado.includes(div.normalizado)) {
      console.log('[matchDivisaoToId] ✅ Match parcial:', div.nome, '| Sigla:', div.regionalSigla);
      return { id: div.id, regionalSigla: div.regionalSigla };
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
            console.log('[matchDivisaoToId] ✅ Match por keyword:', div.nome, '(pattern:', pattern, ') | Sigla:', div.regionalSigla);
            return { id: div.id, regionalSigla: div.regionalSigla };
          }
        }
      }
    }
  }
  
  console.log('[matchDivisaoToId] ❌ Nenhum match encontrado para:', divisaoText);
  return { id: null, regionalSigla: null };
}

// Detectar sigla de regional no título original (VP1, VP2, VP3, LN ou numerais romanos)
function detectRegionalSiglaFromTitle(title: string): string | null {
  // 1. Buscar sigla direta (VP1, VP2, VP3, LN, CMD)
  const siglaMatch = title.match(/\b(VP1|VP2|VP3|LN|CMD)\b/i);
  if (siglaMatch) {
    return siglaMatch[1].toUpperCase();
  }
  
  // 2. Detectar numerais romanos após "Vale do Paraíba" ou "VP"
  // "Vale do Paraíba III" → VP3
  // "Vale Paraiba II" → VP2  
  // "VP III" → VP3
  const romanoMatch = title.match(/(?:vale\s*(?:do\s*)?paraiba|VP)\s*(III|II|I)\b/i);
  if (romanoMatch) {
    const romano = romanoMatch[1].toUpperCase();
    const mapa: Record<string, string> = { 'III': 'VP3', 'II': 'VP2', 'I': 'VP1' };
    return mapa[romano] || null;
  }
  
  // 3. "Litoral Norte" → LN
  if (/litoral\s*norte/i.test(title)) {
    return 'LN';
  }
  
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
  
  // Detectar se é evento Caveira (restrito) - match em qualquer posição do título
  const isCaveira = /\bcaveiras?\b/i.test(originalTitle);
  
  console.log('[parseEventComponents] É CMD?', isCMD);
  console.log('[parseEventComponents] É Regional?', isRegional);
  console.log('[parseEventComponents] É Caveira?', isCaveira);
  
  // Detectar tipo de evento (prioridade)
  let tipoEvento = 'Outros';
  let subtipo: string | undefined;
  
  // Caveira tem prioridade máxima
  if (isCaveira) {
    tipoEvento = 'Caveira';
  }
  // PUB tem prioridade
  else if (lower.includes('pub')) {
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
  // Reunião (incluindo bate-papo) - múltiplas formas de detecção para diferentes encodings
  else if (
    lower.includes('reuniao') || 
    lower.includes('reunia') ||
    /reuni[aã]o/i.test(originalTitle) ||
    /reuni[aã]/i.test(normalized) ||
    lower.includes('bate papo') || 
    lower.includes('bate-papo')
  ) {
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
  
  // Variável para armazenar sigla regional detectada diretamente do título
  let regionalSiglaDetectada: string | null = null;
  
  // Se for Caveira, detectar sigla regional e extrair informações extras
  if (isCaveira) {
    // Detectar sigla de regional no título (VP1, VP2, VP3, LN, CMD)
    const siglaMatch = originalTitle.match(/\b(VP1|VP2|VP3|LN|CMD)\b/i);
    regionalSiglaDetectada = siglaMatch ? siglaMatch[1].toUpperCase() : null;
    
    // Usar a regional detectada como divisão (não "Caveira" para evitar duplicação)
    // O badge de tipo já mostra "Caveira"
    divisao = regionalSiglaDetectada || 'Sem Divisao';
    
    console.log('[parseEventComponents] Caveira - Sigla regional detectada:', regionalSiglaDetectada);
    
    // Extrair o título removendo "Caveira/Caveiras" E a sigla da regional
    // "Reunião Caveira VP1" → "Reunião"
    // "Caveiras VP1 Reunião" → "Reunião"
    const tituloSemCaveira = originalTitle
      .replace(/\bcaveiras?\b/gi, '')
      .replace(/\b(VP1|VP2|VP3|LN|CMD)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[-:–]\s*/, '')
      .replace(/\s*[-:–]\s*$/, '')
      .trim();
    
    if (tituloSemCaveira) {
      informacoesExtras = tituloSemCaveira;
    }
  }
  // Se for CMD, usar título original como informações extras
  else if (isCMD) {
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
    // Para eventos Regionais, detectar qual regional especificamente
    // Usar a nova função para detectar sigla (VP1, VP2, VP3, LN ou numerais romanos)
    regionalSiglaDetectada = detectRegionalSiglaFromTitle(originalTitle);
    
    console.log('[parseEventComponents] Regional - Sigla detectada:', regionalSiglaDetectada);
    
    // Usar a sigla detectada para criar a divisão no formato correto
    if (regionalSiglaDetectada) {
      divisao = `Regional ${regionalSiglaDetectada}`;
    } else {
      divisao = 'Regional';
    }
    
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
    regionalSigla: regionalSiglaDetectada, // Para Caveira, já vem preenchida; outros serão preenchidos depois
    informacoesExtras,
    isCMD,
    isRegional,
    isCaveira
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
  
  console.log('[buildNormalizedTitle] Título normalizado:', innerTitle, '| Sigla:', components.regionalSigla);
  return innerTitle;
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

    const allEvents: CalendarEvent[] = []; // Todos os eventos (para sincronização)
    const activeEvents: CalendarEvent[] = []; // Apenas eventos ativos (para exibição)
    
    for (const item of data.items) {
      const originalTitle = item.summary || "Sem titulo";
      const googleStatus = item.status || 'confirmed'; // Status do Google (confirmed, cancelled, tentative)
      
      // Parsear componentes do título
      const components = parseEventComponents(originalTitle);
      
      // Fazer matching de divisão com banco (agora retorna id E sigla)
      const matchResult = await matchDivisaoToId(components.divisao);
      components.divisaoId = matchResult.id;
      
      // Determinar sigla da regional
      if (components.isCaveira && components.regionalSigla) {
        // Para eventos Caveira, manter a sigla detectada no parseEventComponents
        console.log('[fetchCalendarEvents] Caveira - Mantendo sigla detectada:', components.regionalSigla);
      } else if (components.isCMD) {
        // Para eventos CMD, usar sigla "CMD"
        components.regionalSigla = 'CMD';
      } else if (matchResult.regionalSigla) {
        // Para eventos de divisão normal ou regional, usar a sigla encontrada
        components.regionalSigla = matchResult.regionalSigla;
      }
      
      // Construir título normalizado (agora com sigla)
      const normalizedTitle = buildNormalizedTitle(components);
      
      const event: CalendarEvent = {
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
        divisao_id: matchResult.id,
        htmlLink: item.htmlLink || '',
        isComandoEvent: components.isCMD,
        isRegionalEvent: components.isRegional,
        isCaveiraEvent: components.isCaveira,
        googleStatus, // Incluir status do Google
      };
      
      // Adicionar a todos os eventos (para sincronização)
      allEvents.push(event);
      
      // Só adicionar aos eventos ativos se NÃO estiver cancelado/deletado
      // e se tiver um título válido (não vazio)
      if (googleStatus !== 'cancelled' && originalTitle !== 'Sem titulo') {
        activeEvents.push(event);
      } else {
        console.log(`[fetchCalendarEvents] ⚠️ Evento filtrado da exibição (status: ${googleStatus}, titulo: "${originalTitle}")`);
      }
      
      if (!matchResult.id && components.divisao !== 'Sem Divisao' && googleStatus !== 'cancelled') {
        console.warn('[fetchCalendarEvents] ⚠️ Divisão não encontrada no banco:', {
          titulo_original: originalTitle,
          divisao_detectada: components.divisao
        });
      }
    }

    console.log('[fetchCalendarEvents] Total de eventos:', allEvents.length, '| Eventos ativos para exibição:', activeEvents.length);

    // Sincronizar TODOS os eventos (incluindo cancelados) para detectar mudanças de status
    await syncEventsWithDatabase(allEvents);

    // Retornar apenas eventos ativos para exibição na UI
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
