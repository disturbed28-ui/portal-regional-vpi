import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[verificar-alertas-diarios] 🚀 Iniciando verificação diária...');

  try {
    // Cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1️⃣ BUSCAR TODAS AS DIVISÕES ATIVAS
    const { data: divisoes, error: divisoesError } = await supabaseAdmin
      .from('divisoes')
      .select('id, nome')
      .order('nome');

    if (divisoesError) {
      console.error('[verificar-alertas-diarios] ❌ Erro ao buscar divisões:', divisoesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar divisões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!divisoes || divisoes.length === 0) {
      console.log('[verificar-alertas-diarios] ⚠️ Nenhuma divisão encontrada');
      return new Response(
        JSON.stringify({ 
          success: true,
          divisoes_processadas: 0,
          total_emails_enviados: 0,
          message: 'Nenhuma divisão ativa encontrada'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verificar-alertas-diarios] 📍 Encontradas ${divisoes.length} divisões`);

    // 2️⃣ PROCESSAR CADA DIVISÃO
    let totalEmailsEnviados = 0;
    let totalErros = 0;
    const resultados: any[] = [];

    for (const divisao of divisoes) {
      try {
        console.log(`[verificar-alertas-diarios] 📧 Processando ${divisao.nome}...`);

        // Chamar enviar-alerta-inadimplencia usando service role
        const { data: resultado, error: envioError } = await supabaseAdmin.functions.invoke(
          'enviar-alerta-inadimplencia',
          {
            body: {
              tipo_alerta: 'INADIMPLENCIA_70_DIAS',
              divisao_id: divisao.id,
              dry_run: false
            }
          }
        );

        if (envioError) {
          console.error(`[verificar-alertas-diarios] ❌ Erro ao processar ${divisao.nome}:`, envioError);
          totalErros++;
          resultados.push({
            divisao: divisao.nome,
            status: 'erro',
            erro: envioError.message
          });
          continue;
        }

        console.log(`[verificar-alertas-diarios] ✅ ${divisao.nome}: ${resultado.emails_enviados} emails`);
        
        totalEmailsEnviados += resultado.emails_enviados || 0;
        resultados.push({
          divisao: divisao.nome,
          status: 'sucesso',
          emails_enviados: resultado.emails_enviados || 0,
          emails_ignorados: resultado.emails_ignorados || 0,
          emails_erro: resultado.emails_erro || 0
        });

      } catch (error) {
        console.error(`[verificar-alertas-diarios] ❌ Exceção ao processar ${divisao.nome}:`, error);
        totalErros++;
        resultados.push({
          divisao: divisao.nome,
          status: 'erro',
          erro: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    // 3️⃣ REGISTRAR LOG GERAL (opcional)
    const runId = crypto.randomUUID();
    try {
      await supabaseAdmin.from('alertas_emails_log').insert({
        run_id: runId,
        tipo_alerta: 'CRON_SUMMARY',
        registro_id: 0,
        nome_colete: 'Sistema',
        divisao_texto: 'Todas',
        email_destinatario: 'sistema@portal.com',
        destinatario_nome: 'Sistema Automático',
        destinatario_cargo: 'Cron',
        dias_atraso: 0,
        valor_total: 0,
        total_parcelas: totalEmailsEnviados,
        status: totalErros > 0 ? 'erro' : 'enviado',
        erro_mensagem: totalErros > 0 ? `${totalErros} divisões com erro` : null,
        template_version: 'cron_v1'
      });
    } catch (logError) {
      console.error('[verificar-alertas-diarios] ⚠️ Erro ao registrar log geral:', logError);
    }

    console.log(`[verificar-alertas-diarios] 📊 Resumo final: ${divisoes.length} divisões, ${totalEmailsEnviados} emails, ${totalErros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        divisoes_processadas: divisoes.length,
        total_emails_enviados: totalEmailsEnviados,
        total_erros: totalErros,
        timestamp: new Date().toISOString(),
        resultados
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verificar-alertas-diarios] ❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro ao processar verificação diária',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
