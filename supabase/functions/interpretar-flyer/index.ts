import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'openai/gpt-6-astra';

const RESULT_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'interpretacao_flyer',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        eh_evento: { type: 'boolean' },
        titulo: { type: ['string', 'null'] },
        tipo: { type: ['string', 'null'] },
        time_especial: { type: ['string', 'null'] },
        escopo: { type: ['string', 'null'] },
        regional_sigla: { type: ['string', 'null'] },
        divisao_nome: { type: ['string', 'null'] },
        data_evento: { type: ['string', 'null'] },
        hora_inicio: { type: ['string', 'null'] },
        local: { type: ['string', 'null'] },
        ponto_encontro: { type: ['string', 'null'] },
        contato: { type: ['string', 'null'] },
        descricao: { type: ['string', 'null'] },
        dias_semana: { type: ['array', 'null'], items: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] } },
      },
      required: ['eh_evento', 'titulo', 'tipo', 'time_especial', 'escopo', 'regional_sigla', 'divisao_nome', 'data_evento', 'hora_inicio', 'local', 'ponto_encontro', 'contato', 'descricao', 'dias_semana'],
      additionalProperties: false,
    },
  },
};

const PROMPT_SISTEMA = `Voce extrai dados de flyers/textos de eventos de um motoclube brasileiro e responde SOMENTE com JSON valido.

Regras:
- Se o conteudo NAO for um evento (aniversario, aviso, homenagem, etc.), responda {"eh_evento": false}.
- Se for evento, responda {"eh_evento": true, ...campos abaixo}.
- Ignore rodape institucional (nomes de comando, frases de lema, enderecos de sede).
- tipos validos: "Reunião", "Pub", "Ação Social", "Bonde Insano", "Bate e Volta", "Combate". "Combate" = treino de luta (Combate Insano, Jiu-Jitsu, Defesa Pessoal). Arrecadação e Doação de Sangue sao "Ação Social".
- times especiais: se o texto mencionar Caveira, Lobo ou Urso/Ursinho (ex.: "Caveiras VP1", "Reunião Lobo"), preencha time_especial com "caveira", "lobo" ou "ursinho". Caso contrario null. ATENCAO: nomes de LOCAL (ex.: "Garagem do Lobo", "Bar do Urso", "Rancho Caveira") NAO indicam time especial; so preencha quando o texto falar do time/grupo (ex.: "Reunião dos Lobos", "Caveiras VP1").
- escopo (regra de hierarquia, siga estritamente):
  * "divisao": o flyer cita uma divisao especifica.
  * "regional": o flyer cita uma regional (ex.: "Regional Vale do Paraiba I", "VP2", "Litoral Norte") e NENHUMA divisao.
  * "comando": o flyer cita "Comando Regional V", "Comando V", "CMD V", "CMD" ou Comando geral, sem regional nem divisao. "Comando Regional V" NAO e uma regional: e o COMANDO.
  * Nomes de cidades no endereco do local NAO definem divisao nem regional.
- regional_sigla: VP1, VP2, VP3 ou LN quando o flyer citar a regional; "CMD" quando escopo = "comando". Aceite romanos ("Vale do Paraiba II" = VP2). Nunca deduza a regional pela cidade do local. null se nao identificavel.
- divisao_nome: nome da divisao sem o prefixo "Divisao" (ex.: "São José dos Campos Sul", "Caçapava II", "Pindamonhangaba 3"). Inclua SEMPRE a cidade quando o nome for generico: "Extremo Sul" sozinho e ambiguo (existe em Sao Jose dos Campos/VP1 e em Jacarei/VP3) — escreva "Jacarei Extremo Sul" ou "Sao Jose dos Campos Extremo Sul" conforme a cidade indicada no flyer. null se nao houver.
- data_evento: formato YYYY-MM-DD. Se o flyer nao informar o ano, use o ANO CORRENTE informado no contexto. Formatos comuns: "14/11", "14 de novembro", "sab. 08/11".
- dias_semana: se o evento se repete toda semana (ex.: "Segundas e Quartas", "toda sexta"), liste os dias com codigos MO,TU,WE,TH,FR,SA,SU. Caso seja data unica, null. Em eventos semanais sem data especifica, data_evento = null.
- Nomes de RUAS/AVENIDAS (ex.: "Av. Heitor Villa Lobos") tambem NAO indicam time especial.
- hora_inicio: formato HH:MM (24h). null se nao houver.
- local: nome do local e/ou endereco completo do evento.
- ponto_encontro: texto do P.E. (ponto de encontro) com horario, se houver. null se nao houver.
- contato: nome/telefone do responsavel, se houver. null se nao houver.
- titulo: titulo curto no padrao "SIGLA - TIPO - DIVISAO" (ex.: "VP1 - Pub Insano - Divisão São José dos Campos Sul"); para regional sem divisao "VP1 - Pub Insano - Regional"; para comando "CMD - Pub Insano".
- descricao: texto livre relevante do flyer (sem rodape institucional), preservando termos originais.

Responda APENAS o JSON, sem markdown, sem explicacoes.`;

interface ResultadoInterpretacao {
  eh_evento: boolean;
  titulo?: string | null;
  tipo?: string | null;
  time_especial?: string | null;
  escopo?: string | null;
  regional_sigla?: string | null;
  divisao_nome?: string | null;
  data_evento?: string | null;
  hora_inicio?: string | null;
  local?: string | null;
  ponto_encontro?: string | null;
  contato?: string | null;
  descricao?: string | null;
  dias_semana?: string[] | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Permissão via matriz
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: temPermissao } = await supabaseAdmin.rpc('user_has_screen_permission', {
      _user_id: user.id,
      _screen_route: '/agenda/adicionar-evento',
    });
    if (!temPermissao) {
      return new Response(JSON.stringify({ error: 'Sem permissão para adicionar eventos' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { imagem_base64, imagem_mime, texto } = body as {
      imagem_base64?: string; imagem_mime?: string; texto?: string;
    };

    if (!imagem_base64 && !texto?.trim()) {
      return new Response(JSON.stringify({ error: 'Envie um flyer (imagem) ou um texto' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração de IA indisponível' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anoCorrente = new Date().getFullYear();
    const contexto = `ANO CORRENTE: ${anoCorrente}. Interprete o conteudo a seguir.`;

    const userContent: unknown[] = [{ type: 'text', text: texto?.trim() ? `${contexto}\n\nTEXTO:\n${texto.trim()}` : contexto }];
    if (imagem_base64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${imagem_mime || 'image/jpeg'};base64,${imagem_base64}` },
      });
    }

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: PROMPT_SISTEMA },
          { role: 'user', content: userContent },
        ],
        response_format: RESULT_SCHEMA,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error(`[interpretar-flyer] AI gateway ${aiResponse.status}: ${errBody}`);
      return new Response(
        JSON.stringify({ error: 'Falha ao interpretar o flyer', status: aiResponse.status, details: errBody }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || '{}';

    let resultado: ResultadoInterpretacao;
    try {
      resultado = JSON.parse(raw);
    } catch {
      console.error('[interpretar-flyer] JSON inválido da IA:', raw);
      return new Response(JSON.stringify({ error: 'Não consegui interpretar o conteúdo. Tente novamente ou preencha manualmente.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Completa a regional a partir da divisão cadastrada (a cidade do flyer pertence a uma regional conhecida)
    if (resultado.eh_evento && resultado.divisao_nome) {
      const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
      const alvo = norm(`DIVISAO ${resultado.divisao_nome.replace(/^divis[aã]o\s+/i, '')} - SP`);
      const { data: divs } = await supabaseAdmin.from('divisoes').select('nome, regionais(sigla)');
      let achada = (divs || []).find((d: { nome: string }) => norm(d.nome) === alvo) as
        { nome: string; regionais: { sigla: string } | null } | undefined;
      // Sem match exato, tentar match parcial — so vale se for unico (nome generico
      // como "Extremo Sul" existe em mais de uma regional e nao deve ser adivinhado)
      if (!achada) {
        const termo = norm(String(resultado.divisao_nome).replace(/^divis[aã]o\s+/i, ''));
        const parciais = (divs || []).filter((d: { nome: string }) => {
          const n = norm(d.nome).replace(/^DIVISAO\s+/, '').replace(/\s*-\s*SP\s*$/, '');
          return n.includes(termo) || termo.includes(n);
        });
        if (parciais.length === 1) achada = parciais[0];
      }
      const sigla = achada?.regionais?.sigla;
      if (sigla) {
        resultado.regional_sigla = sigla;
        resultado.escopo = 'divisao';
        if (resultado.titulo) {
          resultado.titulo = resultado.titulo.replace(/^(CMD|VP\d|LN)\s*-\s*/i, `${sigla} - `);
          if (!resultado.titulo.startsWith(`${sigla} - `)) resultado.titulo = `${sigla} - ${resultado.titulo}`;
        }
      }
    }

    return new Response(JSON.stringify(resultado), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[interpretar-flyer] Erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
