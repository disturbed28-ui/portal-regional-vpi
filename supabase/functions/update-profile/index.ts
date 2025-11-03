import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDatabaseError, logError } from '../_shared/error-handler.ts';

// Função para enviar notificação por email aos admins - DESABILITADA TEMPORARIAMENTE
/*
async function sendAdminNotification(profileData: any) {
  try {
    console.log('Configurando transporter SMTP...');
    
    // Configurar transporter com Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'), // smtp.gmail.com
      port: parseInt(Deno.env.get('SMTP_PORT') || '465'), // 465
      secure: Deno.env.get('SMTP_SECURE') === 'ssl', // true para SSL
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    console.log('Verificando conexão SMTP...');
    await transporter.verify();
    console.log('Conexão SMTP verificada com sucesso!');

    // Buscar emails dos admins
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError || !adminRoles || adminRoles.length === 0) {
      console.log('Nenhum admin encontrado ou erro:', adminError);
      return;
    }

    console.log(`Encontrados ${adminRoles.length} admins`);

    // Buscar emails dos admins via auth.users com paginação adequada
    const adminIds = adminRoles.map((r: any) => r.user_id);
    console.log('Admin IDs a buscar:', adminIds);
    
    // Método 1: Tentar listUsers com paginação maior
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Aumentar limite
    });
    
    console.log('Auth users retornados:', authUsers?.users?.length || 0);
    console.log('Erro ao buscar auth users:', authError);
    
    let adminEmails: string[] = [];
    
    if (authUsers?.users) {
      adminEmails = authUsers.users
        .filter((u: any) => adminIds.includes(u.id))
        .map((u: any) => u.email)
        .filter(Boolean) as string[];
      
      console.log('Emails encontrados via listUsers:', adminEmails);
    }

    // Método 2 (Fallback): Se não encontrou emails, buscar individualmente
    if (adminEmails.length === 0) {
      console.log('Tentando método alternativo: getUserById para cada admin...');
      
      const emailPromises = adminIds.map(async (id: string) => {
        try {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
          if (userError) {
            console.error(`Erro ao buscar usuário ${id}:`, userError);
            return null;
          }
          console.log(`Email encontrado para ${id}:`, userData?.user?.email);
          return userData?.user?.email;
        } catch (err) {
          console.error(`Exceção ao buscar usuário ${id}:`, err);
          return null;
        }
      });
      
      const emails = await Promise.all(emailPromises);
      adminEmails = emails.filter(Boolean) as string[];
      console.log('Emails encontrados via getUserById:', adminEmails);
    }

    // Método 3 (Último recurso): Email hardcoded como fallback
    if (adminEmails.length === 0) {
      console.warn('⚠️ FALLBACK: Usando email hardcoded');
      adminEmails = ['diretor.regional.vale1@gmail.com'];
    }

    console.log(`✅ Total de ${adminEmails.length} email(s) para notificação:`, adminEmails);

    console.log(`Enviando email para ${adminEmails.length} admins`);

    // URL do portal
    const portalUrl = `https://48ecd9cb-adf8-4eee-8548-c826c493e103.lovableproject.com/admin`;

    // Enviar email
    const info = await transporter.sendMail({
      from: `"Portal Regional VP1" <${Deno.env.get('SMTP_USER')}>`,
      to: adminEmails.join(', '),
      subject: '🆕 Novo Cadastro Aguardando Análise',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; }
            .data-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
            .data-row { margin: 10px 0; }
            .label { font-weight: bold; color: #374151; }
            .value { color: #6b7280; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">🆕 Novo Cadastro Recebido</h2>
            </div>
            <div class="content">
              <p>Um novo usuário completou seu cadastro no Portal Regional Vale do Paraíba I - SP e está aguardando aprovação.</p>
              
              <div class="data-box">
                <h3 style="margin-top: 0; color: #dc2626;">Dados do Integrante</h3>
                <div class="data-row">
                  <span class="label">Nome:</span> 
                  <span class="value">${profileData.name || 'Não informado'}</span>
                </div>
                <div class="data-row">
                  <span class="label">Nome de Colete:</span> 
                  <span class="value">${profileData.nome_colete || 'Não informado'}</span>
                </div>
                <div class="data-row">
                  <span class="label">Telefone:</span> 
                  <span class="value">${profileData.telefone || 'Não informado'}</span>
                </div>
                <div class="data-row">
                  <span class="label">Status:</span> 
                  <span class="value">${profileData.profile_status || 'Em Análise'}</span>
                </div>
                <div class="data-row">
                  <span class="label">Data de Cadastro:</span> 
                  <span class="value">${new Date().toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${portalUrl}" class="button">
                  Acessar Portal de Administração →
                </a>
              </div>
              
              <div class="footer">
                <p>Esta é uma notificação automática do Portal Regional<br>Vale do Paraíba I - SP</p>
                <p style="margin-top: 10px; font-size: 11px;">Para parar de receber estas notificações, contate o administrador do sistema.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Novo Cadastro Recebido

Um novo usuário completou seu cadastro e está aguardando aprovação.

Dados do Integrante:
- Nome: ${profileData.name || 'Não informado'}
- Nome de Colete: ${profileData.nome_colete || 'Não informado'}
- Telefone: ${profileData.telefone || 'Não informado'}
- Status: ${profileData.profile_status || 'Em Análise'}

Acesse o portal: ${portalUrl}
      `,
    });

    console.log('Email enviado com sucesso! Message ID:', info.messageId);
    console.log('Destinatários:', adminEmails);
  } catch (error) {
    console.error('Erro ao enviar email de notificação:', error);
    // Não lançar erro para não bloquear o update do perfil
  }
}
*/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      user_id: z.string().uuid('ID de usuário inválido'),
      nome_colete: z.string().trim().min(1, 'Nome de colete é obrigatório').max(100),
      telefone: z.string().max(20).optional(),
      profile_status: z.string().max(50).optional()
    });

    const { user_id, nome_colete, telefone, profile_status } = requestSchema.parse(await req.json());
    
    console.log('Request data:', { user_id, nome_colete, telefone, profile_status });

    // Usar service role para bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Updating profile for user_id:', user_id);

    const updateData: any = {
      nome_colete: nome_colete.trim(),
      profile_status: profile_status || 'Analise',
      observacao: null
    };

    if (telefone) {
      updateData.telefone = telefone.trim();
    }

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

    // Enviar notificação para admins (não-bloqueante) - DESABILITADO TEMPORARIAMENTE
    // console.log('Tentando enviar notificação para admins...');
    // sendAdminNotification(data).catch(err => {
    //   console.error('Falha ao enviar notificação (não-crítico):', err);
    // });

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
