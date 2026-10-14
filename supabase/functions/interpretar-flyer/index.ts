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
      },
      required: ['eh_evento', 'titulo', 'tipo', 'time_especial', 'escopo', 'regional_sigla', 'divisao_nome', 'data_evento', 'hora_inicio', 'local', 'ponto_encontro', 'contato', 'descricao'],
      additionalProperties: false,
    },
  },
};

const PROMPT_SISTEMA = `Voce extrai dados de flyers/textos de eventos de um motoclube brasileiro e responde SOMENTE com JSON valido.

Regras:
- Se o conteudo NAO for um evento (aniversario, aviso, homenagem, etc.), responda {"eh_evento": false}.
- Se for evento, responda {"eh_evento": true, ...campos abaixo}.
- Ignore rodape institucional (nomes de comando, frases de lema, enderecos de sede).
- tipos validos: "Reunião", "Pub", "Ação Social", "Bonde Insano", "Bate e Volta". Arrecadação e Doação de Sangue sao "Ação Social".
- times especiais: se o texto mencionar Caveira, Lobo ou Urso/Ursinho (ex.: "Caveiras VP1", "Reunião Lobo"), preencha time_especial com "caveira", "lobo" ou "ursinho". Caso contrario null.
- escopo: "divisao" (evento de uma divisao), "regional" (evento de regional inteira ou Comando Regional) ou "comando" (CMD / Comando geral).
- regional_sigla: VP1, VP2, VP3, LN ou CMD, se identificavel (aceite romanos: "Vale do Paraiba II" = VP2). null se nao identificavel.
- divisao_nome: nome da divisao sem o prefixo "Divisao" (ex.: "São José dos Campos Sul", "Caçapava II", "Pindamonhangaba 3"). null se nao houver.
- data_evento: formato YYYY-MM-DD. Se o flyer nao informar o ano, use o ANO CORRENTE informado no contexto. Formatos comuns: "14/11", "14 de novembro", "sab. 08/11".
- hora_inicio: formato HH:MM (24h). null se nao houver.
- local: nome do local e/ou endereco completo do evento.
- ponto_encontro: texto do P.E. (ponto de encontro) com horario, se houver. null se nao houver.
- contato: nome/telefone do responsavel, se houver. null se nao houver.
- titulo: titulo curto do evento no padrao "TIPO - DIVISAO/REGIONAL" (ex.: "Pub Insano - Divisão São José dos Campos Sul").
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
