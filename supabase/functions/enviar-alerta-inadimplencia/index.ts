import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, renderAlertTemplate } from '../_shared/email-service.ts';

const requestSchema = z.object({
  tipo_alerta: z.enum(['INADIMPLENCIA_70_DIAS']),
  divisao_id: z.string().uuid(),
  dry_run: z.boolean().optional().default(false),
  test_email: z.string().email().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse e validação do payload
    const payload = requestSchema.parse(await req.json());
    console.log('[enviar-alerta] 📥 Payload recebido:', payload);

    // Obter JWT do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente Supabase com JWT do usuário
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[enviar-alerta] ❌ Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[enviar-alerta] 👤 Usuário autenticado:', user.id);

    // Cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1️⃣ VALIDAR PERMISSÕES via has_permission()
    console.log('[enviar-alerta] 🔐 Verificando permissões...');
    const { data: hasPermission, error: permError } = await supabaseAdmin
      .rpc('has_permission', {
        _user_id: user.id,
        _permission_code: 'ALERTAS_INADIMPLENCIA:SEND:OWN_DIVISION',
        _divisao_id: payload.divisao_id
      });

    if (permError || !hasPermission) {
      console.error('[enviar-alerta] ❌ Permissão negada:', permError);
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para enviar alertas nesta divisão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[enviar-alerta] ✅ Permissão concedida');

    // 2️⃣ BUSCAR DADOS DA DIVISÃO
    const { data: divisao, error: divisaoError } = await supabaseAdmin
      .from('divisoes')
      .select('id, nome, regional_id, regionais(nome)')
      .eq('id', payload.divisao_id)
      .single();

    if (divisaoError || !divisao) {
      console.error('[enviar-alerta] ❌ Divisão não encontrada:', divisaoError);
      return new Response(
        JSON.stringify({ error: 'Divisão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[enviar-alerta] 📍 Divisão:', divisao.nome);

    // 3️⃣ BUSCAR DIRETOR DA DIVISÃO via v_user_effective_roles
    const { data: diretorRoles, error: diretorRolesError } = await supabaseAdmin
      .from('v_user_effective_roles')
      .select('user_id')
      .eq('effective_role', 'diretor_divisao')
      .limit(1);

    if (diretorRolesError || !diretorRoles || diretorRoles.length === 0) {
      console.error('[enviar-alerta] ❌ Nenhum diretor encontrado:', diretorRolesError);
      return new Response(
        JSON.stringify({ error: 'Nenhum diretor de divisão encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar diretor da divisão específica via profiles
    const { data: diretorProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, cargo, divisao_id')
      .eq('divisao_id', payload.divisao_id)
      .in('id', diretorRoles.map(r => r.user_id))
      .maybeSingle();

    if (profileError || !diretorProfile) {
      console.error('[enviar-alerta] ❌ Perfil do diretor não encontrado:', profileError);
      return new Response(
        JSON.stringify({ error: 'Diretor da divisão não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar email do diretor via auth.admin
    const { data: diretorAuth, error: authDiretorError } = await supabaseAdmin.auth.admin.getUserById(diretorProfile.id);
    if (authDiretorError || !diretorAuth.user?.email) {
      console.error('[enviar-alerta] ❌ Email do diretor não encontrado:', authDiretorError);
      return new Response(
        JSON.stringify({ error: 'Email do diretor não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const diretor = {
      nome: diretorProfile.name,
      email: diretorAuth.user.email,
      cargo: diretorProfile.cargo || 'Diretor de Divisão'
    };

    console.log('[enviar-alerta] 👔 Diretor:', diretor.nome, '-', diretor.email);

    // 4️⃣ BUSCAR DEVEDORES ELEGÍVEIS (>= 70 dias ≈ 3 meses)
    const { data: devedores, error: devedoresError } = await supabaseAdmin
      .from('vw_devedores_ativos')
      .select('*')
      .eq('divisao_texto', divisao.nome)
      .gte('meses_devendo', 3)
      .gt('total_devido', 0)
      .order('ultimo_vencimento', { ascending: true });

    if (devedoresError) {
      console.error('[enviar-alerta] ❌ Erro ao buscar devedores:', devedoresError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar devedores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[enviar-alerta] 💰 Devedores encontrados:', devedores?.length || 0);

    if (!devedores || devedores.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          divisao: divisao.nome,
          total_devedores: 0,
          emails_enviados: 0,
          message: 'Nenhum devedor elegível encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5️⃣ MODO DRY-RUN
    if (payload.dry_run) {
      console.log('[enviar-alerta] 🧪 Modo DRY-RUN ativado');
      
      const preview = devedores.map(d => ({
        nome_colete: d.nome_colete,
        dias_atraso: Math.floor((Date.now() - new Date(d.ultimo_vencimento).getTime()) / (1000 * 60 * 60 * 24)),
        valor_total: Number(d.total_devido),
        total_parcelas: d.total_parcelas,
        destinatario_email: payload.test_email || diretor.email,
        cc_emails: []
      }));

      return new Response(
        JSON.stringify({
          dry_run: true,
          divisao: divisao.nome,
          diretor: { nome: diretor.nome, email: diretor.email },
          devedores_encontrados: devedores.length,
          emails_enviados: 0,
          preview
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6️⃣ ENVIO REAL
    console.log('[enviar-alerta] 📧 Iniciando envio real...');
    
    const runId = crypto.randomUUID();
    let enviados = 0;
    let ignorados = 0;
    let erros = 0;
    const logs: any[] = [];

    for (const devedor of devedores) {
      try {
        const diasAtraso = Math.floor((Date.now() - new Date(devedor.ultimo_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        
        // Gerar payload_hash para dedupe
        const encoder = new TextEncoder();
        const data = encoder.encode(`${payload.tipo_alerta}|${devedor.registro_id}|${payload.divisao_id}|${new Date().toISOString().split('T')[0]}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Verificar duplicatas (últimas 24h)
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        
        const { data: duplicatas, error: dupeError } = await supabaseAdmin
          .from('alertas_emails_log')
          .select('id')
          .eq('payload_hash', payloadHash)
          .in('status', ['enviado', 'processando'])
          .gte('enviado_em', ontem.toISOString())
          .limit(1);

        if (dupeError) {
          console.error('[enviar-alerta] ⚠️ Erro ao verificar duplicatas:', dupeError);
        }

        if (duplicatas && duplicatas.length > 0) {
          console.log(`[enviar-alerta] ⏭️ Ignorando ${devedor.nome_colete} (já enviado < 24h)`);
          
          await supabaseAdmin.from('alertas_emails_log').insert({
            run_id: runId,
            tipo_alerta: payload.tipo_alerta,
            registro_id: devedor.registro_id,
            nome_colete: devedor.nome_colete,
            divisao_texto: divisao.nome,
            email_destinatario: diretor.email,
            destinatario_nome: diretor.nome,
            destinatario_cargo: diretor.cargo,
            dias_atraso: diasAtraso,
            valor_total: Number(devedor.total_devido),
            total_parcelas: devedor.total_parcelas,
            status: 'ignorado',
            motivo_ignorado: 'Enviado recentemente (< 24h)',
            payload_hash: payloadHash,
            template_version: 'v1'
          });
          
          ignorados++;
          continue;
        }

        // Renderizar template
        const { html, text } = renderAlertTemplate({
          nome_colete: devedor.nome_colete,
          divisao_texto: divisao.nome,
          dias_atraso: diasAtraso,
          valor_total: Number(devedor.total_devido),
          total_parcelas: devedor.total_parcelas,
          destinatario_nome: diretor.nome,
          destinatario_cargo: diretor.cargo,
          tipo_alerta: payload.tipo_alerta
        }, 'v1');

        // Enviar email
        const emailResult = await sendEmail({
          to: payload.test_email || diretor.email,
          subject: `⚠️ Alerta: Inadimplência de ${devedor.nome_colete} - ${divisao.nome}`,
          html,
          text
        });

        // Registrar log
        const logEntry = {
          run_id: runId,
          tipo_alerta: payload.tipo_alerta,
          registro_id: devedor.registro_id,
          nome_colete: devedor.nome_colete,
          divisao_texto: divisao.nome,
          email_destinatario: payload.test_email || diretor.email,
          destinatario_nome: diretor.nome,
          destinatario_cargo: diretor.cargo,
          dias_atraso: diasAtraso,
          valor_total: Number(devedor.total_devido),
          total_parcelas: devedor.total_parcelas,
          status: emailResult.success ? 'enviado' : 'erro',
          message_id: emailResult.messageId || null,
          erro_mensagem: emailResult.error || null,
          payload_hash: payloadHash,
          template_version: 'v1'
        };

        await supabaseAdmin.from('alertas_emails_log').insert(logEntry);
        
        if (emailResult.success) {
          enviados++;
          console.log(`[enviar-alerta] ✅ Email enviado para ${devedor.nome_colete}`);
        } else {
          erros++;
          console.error(`[enviar-alerta] ❌ Erro ao enviar para ${devedor.nome_colete}:`, emailResult.error);
        }

        logs.push(logEntry);

      } catch (error) {
        console.error(`[enviar-alerta] ❌ Exceção ao processar ${devedor.nome_colete}:`, error);
        erros++;
      }
    }

    console.log(`[enviar-alerta] 📊 Resumo: ${enviados} enviados, ${ignorados} ignorados, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        divisao: divisao.nome,
        total_devedores: devedores.length,
        emails_enviados: enviados,
        emails_ignorados: ignorados,
        emails_erro: erros,
        logs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[enviar-alerta] ❌ Erro de validação:', error.errors);
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.error('[enviar-alerta] ❌ Erro não tratado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
