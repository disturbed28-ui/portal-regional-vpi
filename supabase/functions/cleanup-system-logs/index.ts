import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';

const RETENTION_DAYS = 90;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[cleanup-system-logs] 🧹 Iniciando limpeza de logs antigos...');

  try {
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('CLEANUP_SYSTEM_LOGS_SECRET');

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      console.error('[cleanup-system-logs] ❌ Autenticação inválida');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateISO = cutoffDate.toISOString();

    console.log(`[cleanup-system-logs] 📅 Data de corte: ${cutoffDateISO} (${RETENTION_DAYS} dias atrás)`);

    const { count: countBefore, error: countError } = await supabaseAdmin
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDateISO);

    if (countError) {
      console.error('[cleanup-system-logs] ⚠️ Erro ao contar registros:', countError);
      logError('cleanup-system-logs', countError, { step: 'count' });
    }

    const recordsToDelete = countBefore || 0;
    console.log(`[cleanup-system-logs] 🗑️ Registros a serem apagados: ${recordsToDelete}`);

    if (recordsToDelete > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('system_logs')
        .delete()
        .lt('created_at', cutoffDateISO);

      if (deleteError) {
        console.error('[cleanup-system-logs] ❌ Erro ao apagar registros:', deleteError);
        logError('cleanup-system-logs', deleteError, {
          cutoffDate: cutoffDateISO,
          recordsToDelete,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao apagar logs antigos',
            details: deleteError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[cleanup-system-logs] ✅ ${recordsToDelete} registro(s) apagado(s) com sucesso`);
    } else {
      console.log('[cleanup-system-logs] ℹ️ Nenhum registro antigo para apagar');
    }

    const { count: countAfter } = await supabaseAdmin
      .from('system_logs')
      .select('*', { count: 'exact', head: true });

    console.log(`[cleanup-system-logs] 📊 Total de logs restantes: ${countAfter || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: recordsToDelete,
        remaining_count: countAfter || 0,
        cutoff_date: cutoffDateISO,
        retention_days: RETENTION_DAYS,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-system-logs] ❌ Erro crítico:', error);
    logError('cleanup-system-logs', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro inesperado ao executar limpeza',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
