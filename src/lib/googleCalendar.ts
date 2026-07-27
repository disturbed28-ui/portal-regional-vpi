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

// ===== Extração e abreviação do complemento do título =====

// Padrões do tipo de evento que devem sair do texto residual
const TIPO_REGEX: Record<string, RegExp[]> = {
  'PUB': [/\bPUBS?\b/g],
  'Acao Social': [/\bACAO\s+SOCIAL\b/g, /\bACOES\s+SOCIAIS\b/g, /\bARRECADACAO\b/g],
  'Reuniao': [/\bREUNIAO\b/g, /\bREUNIOES\b/g, /\bBATE[-\s]?PAPO\b/g],
  'Bate e Volta': [/\bBATE\s*E?\s*VOLTA\b/g, /\bBATE-VOLTA\b/g],
  'Bonde Insano': [/\bBONDE\s+INSANO\b/g, /\bBONDE\b/g, /\bVIAGEM\s+INSANA\b/g],
  'Caveira': [/\bCAVEIRAS?\b/g],
};

// Apelidos usados nos títulos para identificar a divisão do evento
const ALIASES_DIVISAO: Array<{ chave: string; padroes: RegExp[] }> = [
  { chave: 'EXTREMO SUL', padroes: [/\bEXTREMO\s+SUL\b/g, /\bEXT\.?\s*SUL\b/g] },
  { chave: 'EXTREMO NORTE', padroes: [/\bEXTREMO\s+NORTE\b/g, /\bEXT\.?\s*NORTE\b/g] },
  { chave: 'EXTREMO LESTE', padroes: [/\bEXTREMO\s+LESTE\b/g, /\bEXT\.?\s*LESTE\b/g] },
  { chave: 'SAO JOSE DOS CAMPOS', padroes: [/\bSAO\s+JOSE\s+DOS\s+CAMPOS\b/g, /\bSAO\s+JOSE\b/g, /\bSJC\b/g] },
  { chave: 'JACAREI', padroes: [/\bJACAREI\b/g, /\bJAC\.?\b/g] },
  { chave: 'CACAPAVA', padroes: [/\bCACAPAVA\b/g] },
  { chave: 'CENTRO', padroes: [/\bCENTRO\b/g] },
  { chave: 'NORTE', padroes: [/\bNORTE\b/g] },
  { chave: 'SUL', padroes: [/\bSUL\b/g] },
  { chave: 'LESTE', padroes: [/\bLESTE\b/g] },
  { chave: 'OESTE', padroes: [/\bOESTE\b/g] },
];

const STOPWORDS_EXTRAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E', 'A', 'O', 'NA', 'NO', 'EM', 'SP']);

function limparBordas(texto: string): string {
  return texto
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:|,.\/]+/, '')
    .replace(/[\s\-–—:|,.\/]+$/, '')
    .replace(/\s+([-–—:|])\s+\1/g, ' $1 ')
    .trim();
}

/**
 * Remove do título original tudo que já é representado nos outros campos
 * (tipo de evento, divisão detectada, sigla regional) e devolve o que sobrar.
 */
function extrairInformacoesExtras(
  originalTitle: string,
  tipoEvento: string,
  divisaoNome: string
): string | undefined {
  let texto = removeSpecialCharacters(originalTitle).toUpperCase();

  // 1. Tipo de evento
  (TIPO_REGEX[tipoEvento] || []).forEach((re) => {
    texto = texto.replace(re, ' ');
  });

  // 2. Divisão detectada (apenas a ocorrência que identificou o evento)
  const divNorm = removeSpecialCharacters(divisaoNome || '').toUpperCase();
  if (divNorm && divNorm !== 'SEM DIVISAO') {
    // Nome completo da divisão, se aparecer literalmente
    const nomeLimpo = divNorm.replace(/^DIVISAO\s+/, '').replace(/\s*-\s*SP\s*$/, '').trim();
    if (nomeLimpo && texto.includes(nomeLimpo)) {
      texto = texto.replace(nomeLimpo, ' ');
    }
    // Apelidos - remover somente a PRIMEIRA ocorrência de cada apelido pertencente à divisão.
    // Direções genéricas (NORTE/SUL/...) só são removidas se nenhum apelido específico casou,
    // para não apagar o nome de outra divisão citada no complemento.
    const GENERICOS = new Set(['CENTRO', 'NORTE', 'SUL', 'LESTE', 'OESTE']);
    let casouEspecifico = false;
    for (const alias of ALIASES_DIVISAO) {
      if (!nomeLimpo.includes(alias.chave)) continue;
      if (GENERICOS.has(alias.chave) && casouEspecifico) continue;
      for (const padrao of alias.padroes) {
        const re = new RegExp(padrao.source, 'i'); // sem 'g' => só a 1ª ocorrência
        if (re.test(texto)) {
          texto = texto.replace(re, ' ');
          if (!GENERICOS.has(alias.chave)) casouEspecifico = true;
          break;
        }
      }
    }

    // "DIVISAO"/"DIV" solto sobrando nas bordas do trecho removido
    texto = texto.replace(/^\s*DIVISAO\b/, ' ').replace(/^\s*DIV\.?\b/, ' ');
    texto = texto.replace(/\bDIVISAO\s{2,}/, ' ').replace(/\bDIV\.?\s{2,}/, ' ');
  }

  // 3. Sigla regional / comando
  texto = texto
    .replace(/\bVP\s*(?:[123]|III|II|I)\b/g, ' ')
    .replace(/\bVALE\s+(?:DO\s+)?PARAIBA\s*(?:[123]|III|II|I)?\b/g, ' ')
    .replace(/\bLITORAL\s+NORTE\b/g, ' ')
    .replace(/\bLN\b/g, ' ')
    .replace(/\bCMD\b/g, ' ')
    .replace(/\bCOMANDO\s+(?:MUNDIAL|REGIONAL)\b/g, ' ')
    .replace(/\bREGIONAL\b/g, ' ')
    .replace(/\s*-\s*SP\b/g, ' ');

  // 4. Limpeza
  const limpo = limparBordas(texto);

  // 5. Validação: precisa ter conteúdo real
  const palavras = limpo.split(/\s+/).filter(Boolean).filter(p => !STOPWORDS_EXTRAS.has(p));
  if (palavras.length === 0) return undefined;
  if (limpo.replace(/[^A-Z0-9]/g, '').length < 3) return undefined;

  return limpo;
}

const ABREVIACOES: Array<[RegExp, string]> = [
  [/\bANIVERSARIO\s+DE\s+FUNDACAO\b/g, 'ANIV. FUNDACAO'],
  [/\bANIVERSARIANTES\b/g, 'ANIVERS.'],
  [/\bANIVERSARIO\b/g, 'ANIV.'],
  [/\bCONFRATERNIZACAO\b/g, 'CONFRAT.'],
  [/\bCOMEMORACAO\b/g, 'COMEM.'],
  [/\bINTEGRACAO\b/g, 'INTEGR.'],
  [/\bARRECADACAO\b/g, 'ARREC.'],
  [/\bSAO\s+JOSE\s+DOS\s+CAMPOS\b/g, 'SJC'],
  [/\bJACAREI\b/g, 'JAC'],
  [/\bEXTREMO\b/g, 'EXT'],
  [/\bDIVISAO\b/g, 'DIV.'],
  [/\bREGIONAL\b/g, 'REG.'],
  [/\bCOMANDO\b/g, 'CMD'],
  [/\bSOLIDARIEDADE\b/g, 'SOLID.'],
  [/\bSOLIDARIA\b/g, 'SOLID.'],
  [/\bCAMPANHA\b/g, 'CAMP.'],
  [/\bMOTOCICLISTAS?\b/g, 'MOTOC.'],
  [/\bHOMENAGEM\b/g, 'HOMEN.'],
];

/**
 * Abrevia e encurta o complemento para não estourar o layout,
 * mantendo o sentido do texto original.
 */
export function abreviarExtras(texto: string, limite = 48): string {
  let resultado = texto;
  ABREVIACOES.forEach(([re, sub]) => {
    resultado = resultado.replace(re, sub);
  });
  resultado = limparBordas(resultado);

  if (resultado.length <= limite) return resultado;

  // Remover preposições/artigos redundantes
  resultado = limparBordas(
    resultado
      .split(/\s+/)
      .filter((p, i) => i === 0 || !STOPWORDS_EXTRAS.has(p))
      .join(' ')
  );

  if (resultado.length <= limite) return resultado;

  // Cortar na última palavra inteira
  const cortado = resultado.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return `${(ultimoEspaco > 20 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[\s\-–—:|,.]+$/, '')}…`;
}

// Parsear componentes do título do evento (continua abaixo)

// Parsear componentes do título do evento
async function parseEventComponents(originalTitle: string): Promise<ParsedEvent> {
  const normalized = removeSpecialCharacters(originalTitle);
  const lower = normalized.toLowerCase();
  const upper = normalized.toUpperCase();
  
  const isCaveira = /\bcaveiras?\b/i.test(originalTitle);

  // Detectar CMD: "CMD" sozinho ou "Comando Mundial" (mas NÃO "CMD Regional" / "Comando Regional")
  const hasCMDKeyword = upper.includes('CMD') || /comando\s+mundial/i.test(normalized);
  // Detectar Regional: "Regional", "Comando Regional", "CMD Regional"
  const hasRegionalKeyword = /\bregional\b/i.test(normalized) || /comando\s+regional/i.test(normalized) || /\bcmd\s+regional\b/i.test(normalized);
  
  // Se tem "CMD Regional" ou "Comando Regional", é Regional (não CMD)
  const isRegional = hasRegionalKeyword;
  const isCMD = hasCMDKeyword && !isRegional;
  
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
    informacoesExtras = extrairInformacoesExtras(originalTitle, tipoEvento, '');
  } else if (isCMD) {
    divisao = 'CMD';
    informacoesExtras = extrairInformacoesExtras(originalTitle, tipoEvento, '');
  } else if (isRegional) {
    regionalSiglaDetectada = detectRegionalSiglaFromTitle(originalTitle);
    divisao = regionalSiglaDetectada ? `Regional ${regionalSiglaDetectada}` : 'Regional';
    informacoesExtras = extrairInformacoesExtras(originalTitle, tipoEvento, '');
  } else {
    divisao = await detectDivisionFromTitle(normalized);
    // Fallback: se não achou divisão, mas há sigla regional no título (VP1/VP2/VP3/LN),
    // classificar como evento Regional. Cobre casos como "REUNIÃO ADM VP3 - INTEGRAÇÃO".
    if (divisao === 'Sem Divisao') {
      const siglaFallback = detectRegionalSiglaFromTitle(originalTitle);
      if (siglaFallback && siglaFallback !== 'CMD') {
        regionalSiglaDetectada = siglaFallback;
        divisao = `Regional ${siglaFallback}`;
        return {
          tipoEvento,
          subtipo,
          divisao,
          divisaoId: null,
          regionalSigla: regionalSiglaDetectada,
          informacoesExtras: extrairInformacoesExtras(originalTitle, tipoEvento, ''),
          isCMD: false,
          isRegional: true,
          isCaveira: false,
        };
      }
    }
    informacoesExtras = extrairInformacoesExtras(originalTitle, tipoEvento, divisao);
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
  
  // Informações extras (abreviadas para não estourar o layout)
  if (components.informacoesExtras) {
    const extras = abreviarExtras(components.informacoesExtras);
    if (extras) parts.push(extras);
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
