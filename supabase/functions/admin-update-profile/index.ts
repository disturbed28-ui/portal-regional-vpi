import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDatabaseError, logError } from '../_shared/error-handler.ts';
import { sendEmail, renderProfileStatusChangeTemplate } from '../_shared/email-service.ts';

/**
 * Função de normalização de texto: maiúsculo + sem acentos
 */
function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Notifica o integrante sobre mudança de status via email
 */
async function notifyIntegranteStatusChange(
  profileId: string,
  oldStatus: string,
  newStatus: string,
  profileData: any
): Promise<void> {
  try {
    console.log('[admin-update-profile] 📧 Iniciando notificação de mudança de status...');
    console.log(`[admin-update-profile] Status: ${oldStatus} → ${newStatus}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Buscar email do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profileId);
    
    if (userError || !userData?.user?.email) {
      console.error('[admin-update-profile] ⚠️ Erro ao buscar email do usuário:', userError);
      console.error('[admin-update-profile] ⚠️ User data:', userData);
      return;
    }
    
    const userEmail = userData.user.email;
    console.log('[admin-update-profile] 📧 Email encontrado:', userEmail);
    
    // Renderizar template
    const { html, text } = renderProfileStatusChangeTemplate({
      nome_colete: profileData.nome_colete || 'Integrante',
      name: profileData.name || 'Integrante',
      status_anterior: oldStatus,
      status_novo: newStatus,
      observacao: profileData.observacao || null
    });
    
    // Enviar email
    const emailResult = await sendEmail({
      to: [userEmail],
      subject: 'Insanos MC VP1 – Atualização de status do seu cadastro',
      html,
      text
    }, {
      tipo: 'profile_status_change',
      to_nome: profileData.nome_colete || profileData.name,
      related_user_id: profileId,
      metadata: {
        status_anterior: oldStatus,
        status_novo: newStatus,
        observacao: profileData.observacao
      }
    });
    
    if (emailResult.success) {
      console.log('[admin-update-profile] ✅ Email enviado com sucesso! Message ID:', emailResult.messageId);
      console.log('[admin-update-profile] 📨 Destinatário:', userEmail);
    } else {
      console.error('[admin-update-profile] ❌ Erro ao enviar email:', emailResult.error);
    }
    
  } catch (error) {
    console.error('[admin-update-profile] ❌ Exceção ao enviar notificação:', error);
    // Não lançar erro para não bloquear o update do perfil
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestSchema = z.object({
      admin_user_id: z.string().uuid('ID de admin inválido'),
      profile_id: z.string().uuid('ID de perfil inválido'),
      integrante_portal_id: z.string().uuid().optional().nullable(),
      desvincular: z.boolean().optional(),
      name: z.string().max(200).optional(),
      nome_colete: z.string().max(100).optional().nullable(),
      comando_id: z.string().uuid().optional().nullable(),
      regional: z.string().max(100).optional(),
      divisao: z.string().max(100).optional(),
      cargo: z.string().max(100).optional(),
      funcao: z.string().max(100).optional(),
      regional_id: z.string().uuid().optional().nullable(),
      divisao_id: z.string().uuid().optional().nullable(),
      cargo_id: z.string().uuid().optional().nullable(),
      funcao_id: z.string().uuid().optional().nullable(),
      data_entrada: z.string().optional().nullable(),
      grau: z.string().max(50).optional().nullable(),
      profile_status: z.string().max(50).optional(),
      observacao: z.string().max(1000).optional().nullable(),
      combate_insano: z.boolean().optional()
    });

    const {
      admin_user_id,
      profile_id,
      integrante_portal_id,
      desvincular,
      name,
      nome_colete,
      comando_id,
      regional,
      divisao,
      cargo,
      funcao,
      regional_id,
      divisao_id,
      cargo_id,
      funcao_id,
      data_entrada,
      grau,
      profile_status,
      observacao,
      combate_insano,
    } = requestSchema.parse(await req.json());

    console.log('Checking admin role for user:', admin_user_id);

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id);

    console.log('Roles found:', roles);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      logError('admin-update-profile', roleError || 'Not an admin', { admin_user_id });
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating profile:', profile_id, 'by admin:', admin_user_id);

    // Buscar profile atual antes do update (para comparar status)
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('profile_status')
      .eq('id', profile_id)
      .single();

    if (fetchError) {
      console.error('Error fetching current profile:', fetchError);
    }

    const oldStatus = currentProfile?.profile_status || null;
    console.log('Current profile_status:', oldStatus);

    // Preparar payload de atualização - adicionar apenas campos fornecidos
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Adicionar campos apenas se fornecidos explicitamente
    if (name !== undefined) updatePayload.name = name;
    if (nome_colete !== undefined) updatePayload.nome_colete = nome_colete;
    if (comando_id !== undefined) updatePayload.comando_id = comando_id;
    if (regional_id !== undefined) updatePayload.regional_id = regional_id;
    if (divisao_id !== undefined) updatePayload.divisao_id = divisao_id;
    if (cargo_id !== undefined) updatePayload.cargo_id = cargo_id;
    if (funcao_id !== undefined) updatePayload.funcao_id = funcao_id;
    if (data_entrada !== undefined) updatePayload.data_entrada = data_entrada;
    if (grau !== undefined) updatePayload.grau = grau;
    if (profile_status !== undefined) updatePayload.profile_status = profile_status;
    if (observacao !== undefined) updatePayload.observacao = observacao;

    console.log('Update payload:', updatePayload);

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profile_id)
      .select()
      .single();

    if (updateError) {
      logError('admin-update-profile', updateError, { profile_id });
      return new Response(
        JSON.stringify({ error: handleDatabaseError(updateError) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated successfully:', updatedProfile);

    // Verificar se houve mudança de status e enviar notificação
    const newStatus = updatedProfile.profile_status;
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      console.log('[admin-update-profile] 🔔 Status mudou de', oldStatus, '→', newStatus);
      console.log('[admin-update-profile] 📧 Disparando notificação de mudança de status...');
      
      // Disparar notificação de forma não-bloqueante
      notifyIntegranteStatusChange(profile_id, oldStatus, newStatus, updatedProfile).catch(err => {
        console.error('[admin-update-profile] ⚠️ Falha ao enviar notificação (não-crítico):', err);
      });
    } else {
      console.log('[admin-update-profile] ℹ️ Status não mudou, sem notificação');
    }

    // Se foi solicitado desvinculação
    if (desvincular === true) {
      console.log('Desvincular todos os integrantes do profile:', profile_id);
      
      const { error: unlinkError } = await supabase
        .from('integrantes_portal')
        .update({
          profile_id: null,
          vinculado: false,
          data_vinculacao: null,
        })
        .eq('profile_id', profile_id)
        .eq('vinculado', true);

      if (unlinkError) {
        console.error('Error unlinking integrante_portal:', unlinkError);
      } else {
        console.log('Integrante(s) desvinculado(s) com sucesso');
      }
    }
    // Se foi fornecido integrante_portal_id, vincular
    else if (integrante_portal_id) {
      console.log('Linking integrante_portal:', integrante_portal_id, 'to profile:', profile_id);
      
      // Primeiro, desvincular qualquer integrante anterior deste profile
      await supabase
        .from('integrantes_portal')
        .update({
          profile_id: null,
          vinculado: false,
          data_vinculacao: null,
        })
        .eq('profile_id', profile_id);
      
      // Depois, vincular o novo integrante
      const { error: linkError } = await supabase
        .from('integrantes_portal')
        .update({
          profile_id: profile_id,
          vinculado: true,
          data_vinculacao: new Date().toISOString(),
        })
        .eq('id', integrante_portal_id);

      if (linkError) {
        console.error('Error linking integrante_portal:', linkError);
      } else {
        console.log('Integrante vinculado com sucesso');
      }
    }

    // ======================================================================
    // SINCRONIZAÇÃO: Atualizar integrantes_portal vinculado (se existir)
    // ======================================================================
    if (!desvincular) {
      // Buscar integrante vinculado
      const { data: integranteVinculado } = await supabase
        .from('integrantes_portal')
        .select('id')
        .eq('profile_id', profile_id)
        .eq('vinculado', true)
        .maybeSingle();

      if (integranteVinculado) {
        console.log('[admin-update-profile] 🔄 Sincronizando com integrantes_portal:', integranteVinculado.id);

        // Preparar payload de sincronização
        const syncPayload: any = {
          updated_at: new Date().toISOString(),
        };

        // Sincronizar campos que existem em ambas as tabelas
        if (nome_colete !== undefined) syncPayload.nome_colete = nome_colete;
        if (grau !== undefined) syncPayload.grau = grau;
        if (data_entrada !== undefined) syncPayload.data_entrada = data_entrada;
        if (divisao_id !== undefined) syncPayload.divisao_id = divisao_id;
        if (regional_id !== undefined) syncPayload.regional_id = regional_id;
        if (combate_insano !== undefined) syncPayload.combate_insano = combate_insano;

        // Buscar nomes das entidades para popular campos _texto (NORMALIZADO)
        if (regional_id) {
          const { data: regionalData } = await supabase
            .from('regionais')
            .select('nome')
            .eq('id', regional_id)
            .single();
          if (regionalData) {
            // Normalizar para MAIÚSCULO + SEM ACENTOS
            const regionalNome = normalizarTexto(regionalData.nome);
            syncPayload.regional_texto = `REGIONAL ${regionalNome} - SP`;
          }
        }

        if (divisao_id) {
          const { data: divisaoData } = await supabase
            .from('divisoes')
            .select('nome')
            .eq('id', divisao_id)
            .single();
          if (divisaoData) {
            // Normalizar para MAIÚSCULO + SEM ACENTOS
            let nomeNormalizado = normalizarTexto(divisaoData.nome);
            
            // Verificar se é cargo regional (Grau V)
            if (nomeNormalizado.includes('REGIONAL')) {
              // Manter como regional
              if (!nomeNormalizado.startsWith('REGIONAL')) {
                nomeNormalizado = 'REGIONAL ' + nomeNormalizado.replace(/^DIVISAO\s*/, '');
              }
            } else {
              // Garantir prefixo DIVISAO
              if (!nomeNormalizado.startsWith('DIVISAO')) {
                nomeNormalizado = 'DIVISAO ' + nomeNormalizado;
              }
            }
            
            // Garantir sufixo - SP
            if (!nomeNormalizado.endsWith('- SP')) {
              nomeNormalizado = nomeNormalizado + ' - SP';
            }
            
            syncPayload.divisao_texto = nomeNormalizado;
          }
        }

        if (cargo_id && grau !== undefined) {
          const { data: cargoData } = await supabase
            .from('cargos')
            .select('nome')
            .eq('id', cargo_id)
            .single();
          if (cargoData) {
            syncPayload.cargo_grau_texto = grau ? `${cargoData.nome} ${grau}` : cargoData.nome;
            syncPayload.cargo_nome = cargoData.nome;
          }
        }

        // Só atualizar se houver campos além de updated_at
        if (Object.keys(syncPayload).length > 1) {
          const { error: syncError } = await supabase
            .from('integrantes_portal')
            .update(syncPayload)
            .eq('id', integranteVinculado.id);

          if (syncError) {
            console.error('[admin-update-profile] ❌ Erro ao sincronizar integrantes_portal:', syncError);
          } else {
            console.log('[admin-update-profile] ✅ integrantes_portal sincronizado:', Object.keys(syncPayload));
          }
        } else {
          console.log('[admin-update-profile] ℹ️ Nenhum campo para sincronizar com integrantes_portal');
        }
      } else {
        console.log('[admin-update-profile] ℹ️ Nenhum integrante_portal vinculado a este profile');
      }
    }

    return new Response(
      JSON.stringify({ success: true, profile: updatedProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logError('admin-update-profile', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('admin-update-profile', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
