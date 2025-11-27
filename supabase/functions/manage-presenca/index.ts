import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      action: z.enum(['initialize', 'add', 'add_visitante_externo', 'remove']),
      user_id: z.string().uuid('ID de usuário inválido'),
      evento_agenda_id: z.string().uuid('ID de evento inválido').optional(),
      integrante_id: z.string().uuid('ID de integrante inválido').optional(),
      profile_id: z.string().optional().nullable(),
      divisao_id: z.string().uuid('ID de divisão inválido').optional(),
      justificativa_ausencia: z.enum(['saude', 'trabalho', 'familia', 'nao_justificado']).optional(),
      // Novos campos para visitante externo
      visitante_nome: z.string().min(1).optional(),
      visitante_tipo: z.enum(['externo']).optional(),
    });

    const { action, user_id, evento_agenda_id, integrante_id, profile_id, divisao_id, justificativa_ausencia, visitante_nome, visitante_tipo } = requestSchema.parse(await req.json());

    // Criar cliente Supabase com service role (bypassa RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // ============================================================================
    // HELPER: Identificação de Eventos CMD
    // ============================================================================

    /**
     * Normaliza string removendo acentos, cedilhas e convertendo para maiúsculas
     */
    function normalize(str?: string | null): string {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    }

/**
 * Determina se um evento é ESPECIAL (CMD ou REGIONAL)
 * 
 * Eventos especiais sempre têm status 'presente', nunca 'visitante'
 * 
 * Critérios para CMD:
 * - Título contém " CMD" (ex: "Reunião - CMD V e XX")
 * - tipo_evento contém "CMD"
 * - Nome da divisão contém "CMD"
 * 
 * Critérios para REGIONAL:
 * - Título contém "REGIONAL" (ex: "Reunião - Regional - Grau V Reunião")
 * - tipo_evento contém "REGIONAL"
 */
function isEventoEspecial(evento: { 
  titulo?: string | null; 
  tipo_evento?: string | null 
} | null | undefined, divisaoNome?: string | null): boolean {
  if (!evento) return false;
  
  const t = normalize(evento?.titulo);
  const tipo = normalize(evento?.tipo_evento);
  const div = normalize(divisaoNome);
  
  // Detectar CMD
  const isCmd = t.includes(' CMD') || tipo.includes('CMD') || div.includes('CMD');
  
  // Detectar REGIONAL
  const isRegional = t.includes('REGIONAL') || tipo.includes('REGIONAL');
  
  return isCmd || isRegional;
}

    console.log('[manage-presenca] user_id recebido:', user_id);

    // Verificar se o usuário tem role de admin ou moderator
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id);

    if (rolesError) {
      logError('manage-presenca', rolesError, { user_id });
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roles = userRoles?.map(r => r.role) || [];
    console.log('[manage-presenca] Roles do usuário:', roles);

    const isAuthorized = roles.includes('admin') || roles.includes('moderator') || roles.includes('diretor_divisao');

    if (!isAuthorized) {
      console.log('[manage-presenca] Usuário não autorizado');
      return new Response(
        JSON.stringify({ error: 'Sem permissão para gerenciar presenças' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se for diretor_divisao, validar que o evento pertence à sua divisão
    if (roles.includes('diretor_divisao') && !roles.includes('admin')) {
      // Buscar divisão do usuário
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('divisao_id')
        .eq('id', user_id)
        .single();
      
      if (profileError || !userProfile?.divisao_id) {
        console.log('[manage-presenca] Diretor sem divisão atribuída');
        return new Response(
          JSON.stringify({ error: 'Você não possui divisão atribuída' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar dados completos do evento (incluindo campos para detectar CMD)
      const { data: evento, error: eventoError } = await supabaseAdmin
        .from('eventos_agenda')
        .select('divisao_id, titulo, tipo_evento')
        .eq('id', evento_agenda_id)
        .single();
      
      if (eventoError || !evento) {
        console.log('[manage-presenca] Evento não encontrado');
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar nome da divisão do evento (para detectar CMD)
      let divisaoEventoNome: string | null = null;
      if (evento.divisao_id) {
        const { data: divisaoData } = await supabaseAdmin
          .from('divisoes')
          .select('nome')
          .eq('id', evento.divisao_id)
          .single();
        divisaoEventoNome = divisaoData?.nome || null;
      }

  // Verificar se é evento especial (CMD ou REGIONAL)
  const isEspecial = isEventoEspecial(evento, divisaoEventoNome);
  console.log('[manage-presenca] Evento Especial (CMD/Regional) detectado:', isEspecial);

  // Se for evento especial, permitir acesso independentemente da divisão
  if (isEspecial) {
    console.log('[manage-presenca] Evento Especial (CMD/Regional) - permissão concedida para diretor_divisao');
        // Pular validação de divisão para eventos CMD
      } else {
        // Validar se o evento é da mesma divisão (APENAS para eventos não-CMD)
        if (evento.divisao_id !== userProfile.divisao_id) {
          console.log('[manage-presenca] Diretor tentando editar evento de outra divisão');
          return new Response(
            JSON.stringify({ error: 'Você só pode gerenciar presenças de eventos da sua divisão' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Buscar nome do colete do usuário que está confirmando
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('nome_colete')
      .eq('id', user_id)
      .single();
    
    const confirmado_por_nome = userProfile?.nome_colete || user_id;
    console.log('[manage-presenca] Confirmado por:', confirmado_por_nome);

    // Executar ação
    if (action === 'initialize') {
      console.log('[manage-presenca] Inicializando lista de presença...');

      // ========================================================================
      // REGRA: Carga automática só pode ser executada por:
      // - moderator (qualquer divisão)
      // - diretor_divisao (apenas da MESMA divisão do evento, exceto CMD)
      // ========================================================================

      // Buscar dados do evento para verificar se é CMD
      const { data: eventoInit, error: eventoInitError } = await supabaseAdmin
        .from('eventos_agenda')
        .select('divisao_id, titulo, tipo_evento')
        .eq('id', evento_agenda_id)
        .single();

      if (eventoInitError || !eventoInit) {
        console.error('[manage-presenca] Erro ao buscar evento:', eventoInitError);
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar nome da divisão do evento
      let divisaoEventoNomeInit: string | null = null;
      if (eventoInit.divisao_id) {
        const { data: divisaoData } = await supabaseAdmin
          .from('divisoes')
          .select('nome')
          .eq('id', eventoInit.divisao_id)
          .single();
        divisaoEventoNomeInit = divisaoData?.nome || null;
      }

  // Verificar se é evento especial (CMD ou REGIONAL)
  const isEspecialInit = isEventoEspecial(eventoInit, divisaoEventoNomeInit);
  console.log('[manage-presenca] Initialize - Evento Especial (CMD/Regional):', isEspecialInit);

  // Validar permissão para carga automática
  if (!roles.includes('moderator')) {
    // Se não é moderator, verificar se é diretor_divisao válido
    
    if (!roles.includes('diretor_divisao')) {
      console.log('[manage-presenca] Usuário sem permissão para carga automática');
      return new Response(
        JSON.stringify({ error: 'Apenas moderadores ou diretores de divisão podem inicializar listas de presença' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Se é diretor_divisao e NÃO é evento especial, validar se é da mesma divisão
    if (!isEspecialInit) {
          // Buscar divisão do usuário
          const { data: userProfileInit, error: profileInitError } = await supabaseAdmin
            .from('profiles')
            .select('divisao_id')
            .eq('id', user_id)
            .single();
          
          if (profileInitError || !userProfileInit?.divisao_id) {
            console.log('[manage-presenca] Diretor sem divisão atribuída');
            return new Response(
              JSON.stringify({ error: 'Você não possui divisão atribuída' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (eventoInit.divisao_id !== userProfileInit.divisao_id) {
      console.log('[manage-presenca] Diretor tentando inicializar evento de outra divisão');
      return new Response(
        JSON.stringify({ error: 'Diretores de divisão só podem inicializar listas de eventos da própria divisão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
  // Se for evento especial (CMD/Regional), diretor_divisao pode inicializar independentemente da divisão
}

      // ========================================================================
      // FIM DA VALIDAÇÃO - Continua com a lógica existente de initialize
      // ========================================================================
      
      // Buscar nome da divisão
      const { data: divisao, error: divisaoError } = await supabaseAdmin
        .from('divisoes')
        .select('nome')
        .eq('id', divisao_id)
        .single();
      
      if (divisaoError || !divisao) {
        console.error('[manage-presenca] Erro ao buscar divisão:', divisaoError);
        return new Response(
          JSON.stringify({ error: 'Divisão não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Função para remover acentos e normalizar texto
      const normalizeText = (text: string) => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ') // Normaliza múltiplos espaços em um único
          .toLowerCase()
          .trim();
      };
      
      // Buscar TODOS os integrantes ativos
      const { data: allIntegrantes, error: integrantesError } = await supabaseAdmin
        .from('integrantes_portal')
        .select('id, profile_id, divisao_texto')
        .eq('ativo', true);
      
      if (integrantesError) {
        console.error('[manage-presenca] Erro ao buscar integrantes:', integrantesError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar integrantes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Filtrar integrantes da divisão usando normalização com match exato
      const divisaoNormalizada = normalizeText(divisao.nome);
      const integrantes = (allIntegrantes || []).filter(i => {
        const divisaoIntegranteNormalizada = normalizeText(i.divisao_texto || '');
        // Match exato para evitar que "SJC Norte" pegue integrantes de "SJC Extremo Norte"
        return divisaoIntegranteNormalizada === divisaoNormalizada;
      });
      
      console.log('[manage-presenca] Divisão normalizada:', divisaoNormalizada);
      console.log('[manage-presenca] Integrantes encontrados:', integrantes.length);
      
      if (integrantes.length === 0) {
        console.log('[manage-presenca] Nenhum integrante encontrado para esta divisão');
        return new Response(
          JSON.stringify({ success: true, count: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Criar registros de presença com status='ausente'
      const presencasParaInserir = integrantes.map(i => ({
        evento_agenda_id,
        integrante_id: i.id,
        profile_id: i.profile_id || null,
        status: 'ausente',
        confirmado_por: confirmado_por_nome,
      }));
      
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .insert(presencasParaInserir)
        .select();
      
      if (error) {
        console.error('[manage-presenca] Erro ao inicializar:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao inicializar lista' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[manage-presenca] ${data.length} registros criados`);
      return new Response(
        JSON.stringify({ success: true, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add') {
      console.log('[manage-presenca] Adicionando presença...');
      
      // Verificar se já existe registro
      const { data: existente } = await supabaseAdmin
        .from('presencas')
        .select('id, status')
        .eq('evento_agenda_id', evento_agenda_id)
        .eq('integrante_id', integrante_id)
        .maybeSingle();
      
      if (existente) {
        // Buscar dados do integrante para verificar sua divisão
        const { data: integrante } = await supabaseAdmin
          .from('integrantes_portal')
          .select('divisao_texto')
          .eq('id', integrante_id)
          .single();
        
        // Buscar dados do evento (incluindo campos para detectar CMD)
        const { data: evento } = await supabaseAdmin
          .from('eventos_agenda')
          .select('divisao_id, titulo, tipo_evento')
          .eq('id', evento_agenda_id)
          .single();
        
        // Buscar nome da divisão do evento
        let divisaoEvento: string | null = null;
        if (evento?.divisao_id) {
          const { data: divisaoData } = await supabaseAdmin
            .from('divisoes')
            .select('nome')
            .eq('id', evento.divisao_id)
            .single();
          divisaoEvento = divisaoData?.nome || null;
        }

    // Verificar se é evento especial (CMD ou REGIONAL)
    const isEspecialAdd = isEventoEspecial(evento, divisaoEvento);
    console.log('[manage-presenca] Add - Evento Especial (CMD/Regional):', isEspecialAdd);
    
    // Determinar o status
    let novoStatus = 'visitante'; // padrão

    if (isEspecialAdd) {
      // ✅ EVENTOS ESPECIAIS (CMD/REGIONAL): sempre 'presente', nunca 'visitante'
      novoStatus = 'presente';
      console.log('[manage-presenca] Evento Especial (CMD/Regional) - status forçado para "presente"');
        } else if (integrante?.divisao_texto && divisaoEvento) {
          // Eventos normais: verificar divisão
          const divisaoIntegranteNorm = integrante.divisao_texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
          
          const divisaoEventoNorm = divisaoEvento
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
          
          if (divisaoIntegranteNorm === divisaoEventoNorm) {
            novoStatus = 'presente';
          }
        }
        
        console.log(`[manage-presenca] Integrante divisão: ${integrante?.divisao_texto}, Evento divisão: ${divisaoEvento}, Status: ${novoStatus}`);
        
        // Atualizar status baseado na verificação de divisão
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .update({ 
            status: novoStatus,
            confirmado_em: new Date().toISOString(),
            confirmado_por: confirmado_por_nome,
            justificativa_ausencia: null,
            justificativa_tipo: null,
          })
          .eq('id', existente.id)
          .select()
          .single();
        
        if (error) {
          console.error('[manage-presenca] Erro ao atualizar:', error);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar presença' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`[manage-presenca] Presença atualizada para ${novoStatus}`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Não existe registro - precisa criar novo
        
        // Buscar dados do evento para detectar CMD
        const { data: eventoNovo } = await supabaseAdmin
          .from('eventos_agenda')
          .select('divisao_id, titulo, tipo_evento')
          .eq('id', evento_agenda_id)
          .single();
        
        // Buscar nome da divisão do evento
        let divisaoEventoNomeNovo: string | null = null;
        if (eventoNovo?.divisao_id) {
          const { data: divisaoData } = await supabaseAdmin
            .from('divisoes')
            .select('nome')
            .eq('id', eventoNovo.divisao_id)
            .single();
          divisaoEventoNomeNovo = divisaoData?.nome || null;
        }
        
  // Verificar se é evento especial (CMD ou REGIONAL)
  const isEspecialNovo = isEventoEspecial(eventoNovo, divisaoEventoNomeNovo);
  
  // Definir status inicial
  const statusInicial = isEspecialNovo ? 'presente' : 'visitante';
  console.log('[manage-presenca] Novo registro - Evento Especial (CMD/Regional):', isEspecialNovo, '- Status:', statusInicial);
        
        // Inserir novo registro
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .insert({
            evento_agenda_id,
            integrante_id,
            profile_id: profile_id || null,
            status: statusInicial,
            confirmado_por: confirmado_por_nome,
          })
          .select()
          .single();
        
        if (error) {
          console.error('[manage-presenca] Erro ao inserir:', error);
          return new Response(
            JSON.stringify({ error: 'Erro ao adicionar presença' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
  const tipoPresenca = isEspecialNovo ? 'presente em evento especial (CMD/Regional)' : 'visitante';
  console.log(`[manage-presenca] Presença adicionada (${tipoPresenca})`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'remove') {
      console.log('[manage-presenca] Marcando como ausente...', { justificativa_ausencia });
      
      const updateData: any = { 
        status: 'ausente',
        confirmado_em: new Date().toISOString(),
        confirmado_por: confirmado_por_nome,
      };
      
      if (justificativa_ausencia) {
        updateData.justificativa_ausencia = justificativa_ausencia;
      }
      
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .update(updateData)
        .eq('evento_agenda_id', evento_agenda_id)
        .eq('integrante_id', integrante_id)
        .select()
        .single();
      
      if (error) {
        console.error('[manage-presenca] Erro ao marcar ausente:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao marcar como ausente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[manage-presenca] Marcado como ausente');
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add_visitante_externo') {
      console.log('[manage-presenca] Adicionando visitante externo...', { visitante_nome, visitante_tipo });
      
      if (!visitante_nome) {
        return new Response(
          JSON.stringify({ error: 'Nome do visitante é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Verificar se já existe visitante externo com mesmo nome neste evento
      const { data: existente } = await supabaseAdmin
        .from('presencas')
        .select('id')
        .eq('evento_agenda_id', evento_agenda_id)
        .eq('visitante_nome', visitante_nome.trim())
        .maybeSingle();
      
      if (existente) {
        return new Response(
          JSON.stringify({ error: 'Visitante externo já registrado neste evento' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data, error } = await supabaseAdmin
        .from('presencas')
        .insert({
          evento_agenda_id,
          integrante_id: null,
          profile_id: null,
          status: 'visitante',
          confirmado_em: new Date().toISOString(),
          confirmado_por: confirmado_por_nome,
          visitante_nome: visitante_nome.trim(),
          visitante_tipo: visitante_tipo || 'externo',
        })
        .select()
        .single();
      
      if (error) {
        console.error('[manage-presenca] Erro ao adicionar visitante externo:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao adicionar visitante externo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[manage-presenca] Visitante externo adicionado:', visitante_nome);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      logError('manage-presenca', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('manage-presenca', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});