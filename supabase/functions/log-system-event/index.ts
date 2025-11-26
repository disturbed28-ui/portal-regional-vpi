import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { logError } from '../_shared/error-handler.ts';
import { sendEmail, renderSystemErrorTemplate } from '../_shared/email-service.ts';

// Schema de validação Zod
const logEventSchema = z.object({
  tipo: z.enum([
    'AUTH_ERROR',
    'PERMISSION_DENIED', 
    'FUNCTION_ERROR',
    'NETWORK_ERROR',
    'VALIDATION_ERROR',
    'DATABASE_ERROR',
    'UNKNOWN_ERROR'
  ]),
  origem: z.string().min(1),
  rota: z.string().nullable().optional(),
  mensagem: z.string().nullable().optional(),
  detalhes: z.record(z.any()).nullable().optional()
});

type LogEvent = z.infer<typeof logEventSchema>;

// Tipos considerados críticos para notificação imediata
const CRITICAL_TYPES = ['AUTH_ERROR', 'PERMISSION_DENIED', 'FUNCTION_ERROR'];

// Rate limit: não enviar emails duplicados nas últimas 2 horas
const RATE_LIMIT_HOURS = 2;

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1️⃣ PARSEAR E VALIDAR PAYLOAD
    const payload: LogEvent = logEventSchema.parse(await req.json());
    console.log('[log-system-event] 📥 Evento recebido:', {
      tipo: payload.tipo,
      origem: payload.origem,
      rota: payload.rota
    });

    // 2️⃣ OBTER USER_ID (se autenticado)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
        console.log('[log-system-event] 👤 User ID:', userId);
      }
    } else {
      console.log('[log-system-event] ℹ️ Sem autenticação (erro pré-login)');
    }

    // 3️⃣ CRIAR CLIENTE ADMIN
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4️⃣ INSERIR LOG NA TABELA
    const { data: logData, error: insertError } = await supabaseAdmin
      .from('system_logs')
      .insert({
        user_id: userId,
        tipo: payload.tipo,
        origem: payload.origem,
        rota: payload.rota || null,
        mensagem: payload.mensagem || null,
        detalhes: payload.detalhes || null,
        notificacao_enviada: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('[log-system-event] ❌ Erro ao inserir log:', insertError);
      logError('log-system-event', insertError, { payload });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao registrar log no sistema' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[log-system-event] ✅ Log inserido com ID:', logData.id);

    // 5️⃣ VERIFICAR SE DEVE ENVIAR EMAIL (APENAS TIPOS CRÍTICOS)
    if (CRITICAL_TYPES.includes(payload.tipo)) {
      console.log('[log-system-event] 🚨 Tipo crítico detectado, verificando rate limit...');
      
      // Disparar notificação de forma não-bloqueante
      notifyAdminsIfNeeded(supabaseAdmin, logData, payload)
        .catch(err => {
          console.error('[log-system-event] ⚠️ Falha ao enviar notificação (não-crítico):', err);
          logError('log-system-event:notify', err, { logId: logData.id });
        });
    } else {
      console.log('[log-system-event] ℹ️ Tipo não-crítico, sem notificação');
    }

    // 6️⃣ RETORNAR SUCESSO
    return new Response(
      JSON.stringify({ success: true, logId: logData.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    // Erro de validação ou inesperado
    if (error instanceof z.ZodError) {
      console.error('[log-system-event] ❌ Erro de validação:', error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payload inválido', 
          details: error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.error('[log-system-event] ❌ Erro inesperado:', error);
    logError('log-system-event', error);
    
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar log' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function notifyAdminsIfNeeded(
  supabaseAdmin: any, 
  logData: any, 
  payload: LogEvent
): Promise<void> {
  try {
    // 0️⃣ VERIFICAR SE NOTIFICAÇÕES ESTÃO ATIVAS
    const { data: emailSetting, error: settingError } = await supabaseAdmin
      .from('system_settings')
      .select('valor')
      .eq('chave', 'notificacoes_email_admin')
      .single();

    if (settingError) {
      console.error('[log-system-event] ⚠️ Erro ao buscar configuração de notificações:', settingError);
    }

    const notificacoesAtivas = emailSetting?.valor === true;

    if (!notificacoesAtivas) {
      console.log('[log-system-event] 🔕 Notificações por email desativadas nas configurações');
      return;
    }

    console.log('[log-system-event] ✅ Notificações por email ativas');

    // 1️⃣ VERIFICAR RATE LIMIT (2 horas)
    const rateLimitDate = new Date();
    rateLimitDate.setHours(rateLimitDate.getHours() - RATE_LIMIT_HOURS);

    const { data: recentNotifications, error: rateLimitError } = await supabaseAdmin
      .from('system_logs')
      .select('id')
      .eq('tipo', payload.tipo)
      .eq('rota', payload.rota || '')
      .eq('notificacao_enviada', true)
      .gte('created_at', rateLimitDate.toISOString())
      .limit(1);

    if (rateLimitError) {
      console.error('[log-system-event] ⚠️ Erro ao verificar rate limit:', rateLimitError);
    }

    if (recentNotifications && recentNotifications.length > 0) {
      console.log('[log-system-event] ⏱️ Rate limit ativo - email já enviado recentemente');
      return;
    }

    // 2️⃣ BUSCAR ADMINS
    console.log('[log-system-event] 👥 Buscando administradores...');
    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError || !adminRoles || adminRoles.length === 0) {
      console.warn('[log-system-event] ⚠️ Nenhum admin encontrado:', adminError);
      return;
    }

    console.log(`[log-system-event] ✅ Encontrados ${adminRoles.length} admins`);

    // 3️⃣ BUSCAR EMAILS DOS ADMINS
    const adminIds = adminRoles.map((r: any) => r.user_id);
    const emailPromises = adminIds.map(async (id: string) => {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
        if (userError) {
          console.error(`[log-system-event] ⚠️ Erro ao buscar usuário ${id}:`, userError);
          return null;
        }
        return userData?.user?.email;
      } catch (err) {
        console.error(`[log-system-event] ⚠️ Exceção ao buscar usuário ${id}:`, err);
        return null;
      }
    });

    const emails = await Promise.all(emailPromises);
    const adminEmails = emails.filter(Boolean) as string[];

    if (adminEmails.length === 0) {
      console.warn('[log-system-event] ⚠️ Nenhum email de admin encontrado');
      return;
    }

    console.log(`[log-system-event] 📧 Total de ${adminEmails.length} email(s) para notificação`);

    // 4️⃣ RENDERIZAR TEMPLATE DE EMAIL
    const { html, text } = renderSystemErrorTemplate({
      tipo: payload.tipo,
      origem: payload.origem,
      rota: payload.rota || 'N/A',
      mensagem: payload.mensagem || 'Sem mensagem',
      detalhes: payload.detalhes,
      created_at: logData.created_at
    });

    // 5️⃣ ENVIAR EMAIL
    const emailResult = await sendEmail({
      to: adminEmails,
      subject: `🚨 Insanos MC VP1 – Alerta de erro no sistema (${payload.tipo})`,
      html,
      text
    }, {
      tipo: 'erro_sistema_critico',
      to_nome: 'Administradores',
      metadata: {
        tipo_erro: payload.tipo,
        origem: payload.origem,
        rota: payload.rota,
        log_id: logData.id
      }
    });

    if (emailResult.success) {
      console.log('[log-system-event] ✅ Email enviado! Message ID:', emailResult.messageId);

      // 6️⃣ MARCAR COMO NOTIFICADO
      await supabaseAdmin
        .from('system_logs')
        .update({ notificacao_enviada: true })
        .eq('id', logData.id);

      console.log('[log-system-event] ✅ Log marcado como notificado');
    } else {
      console.error('[log-system-event] ❌ Erro ao enviar email:', emailResult.error);
      logError('log-system-event:email', new Error(emailResult.error || 'Erro desconhecido'), {
        logId: logData.id
      });
    }

  } catch (error) {
    console.error('[log-system-event] ❌ Exceção ao notificar admins:', error);
    logError('log-system-event:notify', error, { logData });
  }
}