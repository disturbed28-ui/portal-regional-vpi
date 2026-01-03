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
      action: z.enum(['initialize', 'initialize_regional', 'initialize_divisao_cmd', 'add', 'add_visitante_externo', 'remove', 'delete_presenca']),
      user_id: z.string().uuid('ID de usuário inválido'),
      evento_agenda_id: z.string().uuid('ID de evento inválido').optional(),
      integrante_id: z.string().uuid('ID de integrante inválido').optional(),
      profile_id: z.string().optional().nullable(),
      divisao_id: z.string().uuid('ID de divisão inválido').optional(),
      regional_id: z.string().uuid('ID de regional inválido').optional(),
      justificativa_ausencia: z.enum(['saude', 'trabalho', 'familia', 'nao_justificado']).optional(),
      // Novos campos para visitante externo
      visitante_nome: z.string().min(1).optional(),
      visitante_tipo: z.enum(['externo']).optional(),
      // Para deletar presença
      presenca_id: z.string().uuid('ID de presença inválido').optional(),
    });

    const { action, user_id, evento_agenda_id, integrante_id, profile_id, divisao_id, regional_id, justificativa_ausencia, visitante_nome, visitante_tipo, presenca_id } = requestSchema.parse(await req.json());

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

    console.log('[manage-presenca] user_id recebido:', user_id, 'action:', action);

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

    const isAuthorized = 
      roles.includes('admin') || 
      roles.includes('moderator') || 
      roles.includes('regional') ||
      roles.includes('diretor_regional') ||
      roles.includes('diretor_divisao');

    if (!isAuthorized) {
      console.log('[manage-presenca] Usuário não autorizado');
      return new Response(
        JSON.stringify({ error: 'Sem permissão para gerenciar presenças' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar nome do colete do usuário que está confirmando
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('nome_colete')
      .eq('id', user_id)
      .single();
    
    const confirmado_por_nome = userProfile?.nome_colete || user_id;
    console.log('[manage-presenca] Confirmado por:', confirmado_por_nome);

    // Função para remover acentos e normalizar texto
    const normalizeText = (text: string) => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    };

    // ========================================================================
    // ACTION: initialize - Inicializar lista de presença para DIVISÃO
    // ========================================================================
    if (action === 'initialize') {
      console.log('[manage-presenca] Inicializando lista de presença para divisão...');
      
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

    // ========================================================================
    // ACTION: initialize_regional - Inicializar lista para EVENTO REGIONAL
    // ========================================================================
    if (action === 'initialize_regional') {
      console.log('[manage-presenca] Inicializando lista para evento REGIONAL...');
      
      if (!regional_id) {
        return new Response(
          JSON.stringify({ error: 'regional_id é obrigatório para eventos regionais' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar todas as divisões da regional
      const { data: divisoes, error: divisoesError } = await supabaseAdmin
        .from('divisoes')
        .select('id, nome')
        .eq('regional_id', regional_id);
      
      if (divisoesError) {
        console.error('[manage-presenca] Erro ao buscar divisões:', divisoesError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar divisões da regional' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[manage-presenca] Divisões da regional:', divisoes?.length || 0);
      
      // Buscar TODOS os integrantes ativos da regional
      const { data: integrantes, error: integrantesError } = await supabaseAdmin
        .from('integrantes_portal')
        .select('id, profile_id, divisao_texto')
        .eq('ativo', true)
        .eq('regional_id', regional_id);
      
      if (integrantesError) {
        console.error('[manage-presenca] Erro ao buscar integrantes:', integrantesError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar integrantes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[manage-presenca] Integrantes da regional:', integrantes?.length || 0);
      
      if (!integrantes || integrantes.length === 0) {
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
        console.error('[manage-presenca] Erro ao inicializar regional:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao inicializar lista regional' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[manage-presenca] Regional: ${data.length} registros criados`);
      return new Response(
        JSON.stringify({ success: true, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: initialize_divisao_cmd - Carregar divisão em EVENTO CMD
    // ========================================================================
    if (action === 'initialize_divisao_cmd') {
      console.log('[manage-presenca] Carregando divisão para evento CMD...');
      
      if (!divisao_id) {
        return new Response(
          JSON.stringify({ error: 'divisao_id é obrigatório para carregar divisão em evento CMD' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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
      
      const divisaoNormalizada = normalizeText(divisao.nome);
      
      // Verificar se já existem integrantes DESTA divisão no evento
      const { data: presencasExistentes, error: checkError } = await supabaseAdmin
        .from('presencas')
        .select(`
          id,
          integrante:integrantes_portal (divisao_texto)
        `)
        .eq('evento_agenda_id', evento_agenda_id)
        .not('integrante_id', 'is', null);
      
      if (checkError) {
        console.error('[manage-presenca] Erro ao verificar presenças existentes:', checkError);
        return new Response(
          JSON.stringify({ error: 'Erro ao verificar presenças' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Verificar se alguma presença é da mesma divisão
      const jaPossui = (presencasExistentes || []).some((p: any) => {
        const divIntegrante = normalizeText(p.integrante?.divisao_texto || '');
        return divIntegrante === divisaoNormalizada;
      });
      
      if (jaPossui) {
        console.log('[manage-presenca] Divisão já carregada neste evento CMD');
        return new Response(
          JSON.stringify({ success: true, already_loaded: true, count: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar integrantes da divisão
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
      
      const integrantes = (allIntegrantes || []).filter(i => {
        const divisaoIntegranteNormalizada = normalizeText(i.divisao_texto || '');
        return divisaoIntegranteNormalizada === divisaoNormalizada;
      });
      
      console.log('[manage-presenca] CMD: Integrantes da divisão:', integrantes.length);
      
      if (integrantes.length === 0) {
        return new Response(
          JSON.stringify({ success: true, already_loaded: false, count: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Criar registros de presença
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
        console.error('[manage-presenca] Erro ao inserir:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao carregar divisão' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[manage-presenca] CMD: ${data.length} integrantes carregados`);
      return new Response(
        JSON.stringify({ success: true, already_loaded: false, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: add - Marcar como presente
    // ========================================================================
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
        
        // Buscar dados do evento
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

        // Normalizar divisões para comparação
        const divisaoIntegranteNorm = normalizeText(integrante?.divisao_texto || '');
        const divisaoEventoNorm = normalizeText(divisaoEvento || '');
        
        // Verificar se divisões são diferentes
        const divisaoDiferente = divisaoEventoNorm && divisaoIntegranteNorm && 
          divisaoIntegranteNorm !== divisaoEventoNorm;
        
        const justificativaTipo = divisaoDiferente ? '(outra divisão)' : null;
        
        console.log(`[manage-presenca] Integrante divisão: ${integrante?.divisao_texto}, Evento divisão: ${divisaoEvento}`);
            
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .update({ 
            status: 'presente',
            confirmado_em: new Date().toISOString(),
            confirmado_por: confirmado_por_nome,
            justificativa_ausencia: null,
            justificativa_tipo: justificativaTipo,
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
        
        console.log(`[manage-presenca] Presença atualizada`);
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Não existe registro - criar novo
        const { data: integranteNovo } = await supabaseAdmin
          .from('integrantes_portal')
          .select('divisao_texto')
          .eq('id', integrante_id)
          .single();
        
        const { data: eventoNovo } = await supabaseAdmin
          .from('eventos_agenda')
          .select('divisao_id, titulo, tipo_evento')
          .eq('id', evento_agenda_id)
          .single();
        
        let divisaoEventoNomeNovo: string | null = null;
        if (eventoNovo?.divisao_id) {
          const { data: divisaoData } = await supabaseAdmin
            .from('divisoes')
            .select('nome')
            .eq('id', eventoNovo.divisao_id)
            .single();
          divisaoEventoNomeNovo = divisaoData?.nome || null;
        }
        
        const divisaoIntegranteNormNovo = normalizeText(integranteNovo?.divisao_texto || '');
        const divisaoEventoNormNovo = normalizeText(divisaoEventoNomeNovo || '');
        
        const divisaoDiferenteNovo = divisaoEventoNormNovo && divisaoIntegranteNormNovo && 
          divisaoIntegranteNormNovo !== divisaoEventoNormNovo;
        
        const justificativaTipoNovo = divisaoDiferenteNovo ? '(outra divisão)' : null;
        
        const { data, error } = await supabaseAdmin
          .from('presencas')
          .insert({
            evento_agenda_id,
            integrante_id,
            profile_id: profile_id || null,
            status: 'presente',
            confirmado_por: confirmado_por_nome,
            justificativa_tipo: justificativaTipoNovo,
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
        
        console.log('[manage-presenca] Presença adicionada');
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========================================================================
    // ACTION: remove - Marcar como ausente
    // ========================================================================
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

    // ========================================================================
    // ACTION: add_visitante_externo
    // ========================================================================
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

    // ========================================================================
    // ACTION: delete_presenca - Excluir completamente da lista
    // ========================================================================
    if (action === 'delete_presenca') {
      console.log('[manage-presenca] Excluindo presença...', { presenca_id });
      
      if (!presenca_id) {
        return new Response(
          JSON.stringify({ error: 'presenca_id é obrigatório para deletar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se a presença existe
      const { data: presenca, error: fetchError } = await supabaseAdmin
        .from('presencas')
        .select('id, evento_agenda_id, integrante_id')
        .eq('id', presenca_id)
        .single();

      if (fetchError || !presenca) {
        console.error('[manage-presenca] Presença não encontrada:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Presença não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deletar usando supabaseAdmin (bypassa RLS)
      const { error: deleteError } = await supabaseAdmin
        .from('presencas')
        .delete()
        .eq('id', presenca_id);

      if (deleteError) {
        logError('manage-presenca', deleteError, { presenca_id });
        return new Response(
          JSON.stringify({ error: 'Erro ao excluir presença' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-presenca] Presença excluída:', presenca_id);
      
      return new Response(
        JSON.stringify({ success: true, deleted_id: presenca_id }),
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

    logError('manage-presenca', error, {});
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
