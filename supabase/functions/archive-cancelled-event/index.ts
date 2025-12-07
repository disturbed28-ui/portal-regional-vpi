import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

interface ArchiveRequest {
  evento_id: string;
  motivo_exclusao: string;
  user_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { evento_id, motivo_exclusao, user_id }: ArchiveRequest = await req.json();

    console.log('[archive-cancelled-event] Iniciando arquivamento:', { evento_id, motivo_exclusao, user_id });

    // Validar inputs
    if (!evento_id || !motivo_exclusao || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: evento_id, motivo_exclusao, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verificar se usuário é admin
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .eq('role', 'admin');

    if (rolesError || !roles || roles.length === 0) {
      console.error('[archive-cancelled-event] Usuário não é admin:', user_id);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas admins podem arquivar eventos.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar evento na tabela principal
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('id', evento_id)
      .single();

    if (eventoError || !evento) {
      console.error('[archive-cancelled-event] Evento não encontrado:', evento_id);
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar todas as presenças associadas
    const { data: presencas, error: presencasError } = await supabase
      .from('presencas')
      .select('*')
      .eq('evento_agenda_id', evento_id);

    if (presencasError) {
      console.error('[archive-cancelled-event] Erro ao buscar presenças:', presencasError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar presenças do evento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[archive-cancelled-event] Presenças encontradas:', presencas?.length || 0);

    // 4. Inserir evento no histórico
    const { data: eventoHistorico, error: insertEventoError } = await supabase
      .from('eventos_agenda_historico')
      .insert({
        evento_original_id: evento.id,
        evento_google_id: evento.evento_id,
        titulo: evento.titulo,
        data_evento: evento.data_evento,
        regional_id: evento.regional_id,
        divisao_id: evento.divisao_id,
        tipo_evento: evento.tipo_evento,
        tipo_evento_peso: evento.tipo_evento_peso,
        status_original: evento.status || 'active',
        evento_created_at: evento.created_at,
        motivo_exclusao: motivo_exclusao,
        excluido_por: user_id
      })
      .select()
      .single();

    if (insertEventoError || !eventoHistorico) {
      console.error('[archive-cancelled-event] Erro ao inserir evento histórico:', insertEventoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao arquivar evento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[archive-cancelled-event] Evento arquivado com ID:', eventoHistorico.id);

    // 5. Inserir presenças no histórico
    if (presencas && presencas.length > 0) {
      const presencasHistorico = presencas.map(p => ({
        evento_historico_id: eventoHistorico.id,
        presenca_original_id: p.id,
        integrante_id: p.integrante_id,
        profile_id: p.profile_id,
        status: p.status,
        justificativa_ausencia: p.justificativa_ausencia,
        justificativa_tipo: p.justificativa_tipo,
        confirmado_em: p.confirmado_em,
        confirmado_por: p.confirmado_por,
        visitante_nome: p.visitante_nome,
        visitante_tipo: p.visitante_tipo
      }));

      const { error: insertPresencasError } = await supabase
        .from('presencas_historico')
        .insert(presencasHistorico);

      if (insertPresencasError) {
        console.error('[archive-cancelled-event] Erro ao inserir presenças histórico:', insertPresencasError);
        // Rollback: deletar evento histórico
        await supabase.from('eventos_agenda_historico').delete().eq('id', eventoHistorico.id);
        return new Response(
          JSON.stringify({ error: 'Erro ao arquivar presenças' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[archive-cancelled-event] Presenças arquivadas:', presencas.length);
    }

    // 6. Deletar presenças da tabela principal
    const { error: deletePresencasError } = await supabase
      .from('presencas')
      .delete()
      .eq('evento_agenda_id', evento_id);

    if (deletePresencasError) {
      console.error('[archive-cancelled-event] Erro ao deletar presenças:', deletePresencasError);
      // Continua mesmo com erro (presenças já estão no histórico)
    }

    // 7. Deletar evento da tabela principal
    const { error: deleteEventoError } = await supabase
      .from('eventos_agenda')
      .delete()
      .eq('id', evento_id);

    if (deleteEventoError) {
      console.error('[archive-cancelled-event] Erro ao deletar evento:', deleteEventoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao remover evento da base principal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[archive-cancelled-event] ✅ Evento arquivado e removido com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Evento arquivado com sucesso',
        evento_historico_id: eventoHistorico.id,
        presencas_arquivadas: presencas?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[archive-cancelled-event] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao arquivar evento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
