import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDatabaseError, logError } from '../_shared/error-handler.ts';
import { sendEmail, renderNewProfileTemplate } from '../_shared/email-service.ts';
import { validarCadastroPerfil, statusAposCadastro } from '../_shared/cadastroPerfil.ts';

// Função para enviar notificação por email aos admins
// Agora usa o serviço centralizado _shared/email-service.ts
async function notifyAdminsNovoCadastroPendente(profileData: any): Promise<void> {
  try {
    console.log('[update-profile] 📧 Iniciando notificação para admins...');
    
    // Criar cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Buscar admins
    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    
    if (adminError || !adminRoles || adminRoles.length === 0) {
      console.warn('[update-profile] ⚠️ Nenhum admin encontrado:', adminError);
      return;
    }
    
    console.log(`[update-profile] 👥 Encontrados ${adminRoles.length} admins`);
    
    // Buscar emails dos admins
    const adminIds = adminRoles.map((r: any) => r.user_id);
    let adminEmails: string[] = [];
    
    // Tentar buscar emails via getUserById
    const emailPromises = adminIds.map(async (id: string) => {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
        if (userError) {
          console.error(`[update-profile] ⚠️ Erro ao buscar usuário ${id}:`, userError);
          return null;
        }
        return userData?.user?.email;
      } catch (err) {
        console.error(`[update-profile] ⚠️ Exceção ao buscar usuário ${id}:`, err);
        return null;
      }
    });
    
    const emails = await Promise.all(emailPromises);
    adminEmails = emails.filter(Boolean) as string[];
    
    console.log('[update-profile] 📧 Emails encontrados:', adminEmails);
    
    // Fallback: email hardcoded
    if (adminEmails.length === 0) {
      console.warn('[update-profile] ⚠️ FALLBACK: Usando email hardcoded');
      adminEmails = ['diretor.regional.vale1@gmail.com'];
    }
    
    console.log(`[update-profile] ✅ Total de ${adminEmails.length} email(s) para notificação`);
    
    // Renderizar template
    const { html, text } = renderNewProfileTemplate({
      name: profileData.name || 'Não informado',
      nome_colete: profileData.nome_colete || 'Não informado',
      telefone: profileData.telefone || 'Não informado',
      profile_status: profileData.profile_status || 'Pendente',
      updated_at: profileData.updated_at || new Date().toISOString()
    });
    
    // Enviar email
    const emailResult = await sendEmail({
      to: adminEmails,
      subject: '🆕 Novo Cadastro Aguardando Análise - Portal Regional VP1',
      html,
      text
    }, {
      tipo: 'novo_cadastro_pendente',
      to_nome: 'Administradores',
      related_user_id: profileData.id,
      metadata: {
        nome_colete: profileData.nome_colete,
        profile_status: profileData.profile_status
      }
    });
    
    if (emailResult.success) {
      console.log('[update-profile] ✅ Email enviado com sucesso! Message ID:', emailResult.messageId);
      console.log('[update-profile] 📨 Destinatários:', adminEmails);
    } else {
      console.error('[update-profile] ❌ Erro ao enviar email:', emailResult.error);
    }
    
  } catch (error) {
    console.error('[update-profile] ❌ Exceção ao enviar notificação:', error);
    // Não lançar erro para não bloquear o update do perfil
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await authClient.auth.getUser(authHeader.slice(7));
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const requestSchema = z.object({
      user_id: z.string().uuid('ID de usuário inválido'),
      nome_colete: z.string().trim().min(1, 'Nome de colete é obrigatório').max(100),
      telefone: z.string().trim().min(1, 'Telefone é obrigatório').max(20),
      instagram: z.string().max(32).nullable().optional(),
      profile_status: z.string().max(50).optional()
    });

    const request = requestSchema.parse(await req.json());
    const { user_id } = request;
    if (user_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: 'Você só pode editar seu próprio cadastro.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let dadosCadastro;
    try { dadosCadastro = validarCadastroPerfil(request); }
    catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Dados inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Usar service role para bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Updating profile for user_id:', user_id);

    const { data: atual, error: leituraError } = await supabaseAdmin.from('profiles').select('profile_status,nome_colete').eq('id', user_id).single();
    if (leituraError || !atual) throw new Error('Cadastro não encontrado');
    const statusAtual = atual.profile_status || 'Pendente';
    const updateData = {
      ...dadosCadastro,
      nome_colete: (statusAtual === 'Ativo' || statusAtual === 'Inativo') ? atual.nome_colete : dadosCadastro.nome_colete,
      profile_status: statusAposCadastro(statusAtual),
      observacao: null
    };

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      logError('update-profile', error, { user_id });
      return new Response(
        JSON.stringify({ error: handleDatabaseError(error) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated successfully:', data);

    // Verificar se deve notificar admins
    if (data.profile_status === 'Pendente') {
      console.log('[update-profile] 🔔 Status Pendente detectado, disparando notificação...');
      // Disparar notificação de forma não-bloqueante
      notifyAdminsNovoCadastroPendente(data).catch(err => {
        console.error('[update-profile] ⚠️ Falha ao enviar notificação (não-crítico):', err);
      });
    } else {
      console.log('[update-profile] ℹ️ Status não é Pendente, sem notificação');
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError('update-profile', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('update-profile', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
