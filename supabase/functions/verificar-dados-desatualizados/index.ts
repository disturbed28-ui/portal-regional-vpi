import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email-service.ts';

const LIMITE_DIAS = 7;

interface DadoDesatualizado {
  tipo: string;
  label: string;
  ultima_atualizacao: string | null;
  dias_desde_atualizacao: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[verificar-dados-desatualizados] 🚀 Iniciando verificação...');

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const agora = new Date();
    const calcDias = (d: string | null): number | null => {
      if (!d) return null;
      return Math.floor((agora.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    };

    // 1️⃣ VERIFICAR DATAS DE ÚLTIMA ATUALIZAÇÃO
    const desatualizados: DadoDesatualizado[] = [];

    // Integrantes
    const { data: cargaInt } = await supabaseAdmin
      .from('cargas_historico')
      .select('data_carga')
      .eq('tipo_carga', 'integrantes')
      .order('data_carga', { ascending: false })
      .limit(1);
    const diasInt = calcDias(cargaInt?.[0]?.data_carga || null);
    if (diasInt === null || diasInt > LIMITE_DIAS) {
      desatualizados.push({
        tipo: 'integrantes',
        label: 'Integrantes',
        ultima_atualizacao: cargaInt?.[0]?.data_carga || null,
        dias_desde_atualizacao: diasInt,
      });
    }

    // Inadimplência
    const { data: cargaMens } = await supabaseAdmin
      .from('mensalidades_atraso')
      .select('data_carga')
      .eq('ativo', true)
      .order('data_carga', { ascending: false })
      .limit(1);
    const diasMens = calcDias(cargaMens?.[0]?.data_carga || null);
    if (diasMens === null || diasMens > LIMITE_DIAS) {
      desatualizados.push({
        tipo: 'inadimplencia',
        label: 'Inadimplência',
        ultima_atualizacao: cargaMens?.[0]?.data_carga || null,
        dias_desde_atualizacao: diasMens,
      });
    }

    // Aniversariantes
    const { data: ultimoAniv } = await supabaseAdmin
      .from('integrantes_portal')
      .select('updated_at')
      .not('data_nascimento', 'is', null)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(1);
    const diasAniv = calcDias(ultimoAniv?.[0]?.updated_at || null);
    if (diasAniv === null || diasAniv > LIMITE_DIAS) {
      desatualizados.push({
        tipo: 'aniversariantes',
        label: 'Aniversariantes',
        ultima_atualizacao: ultimoAniv?.[0]?.updated_at || null,
        dias_desde_atualizacao: diasAniv,
      });
    }

    // Afastados
    const { data: cargaAfast } = await supabaseAdmin
      .from('cargas_historico')
      .select('data_carga')
      .eq('tipo_carga', 'afastados')
      .order('data_carga', { ascending: false })
      .limit(1);
    const diasAfast = calcDias(cargaAfast?.[0]?.data_carga || null);
    if (diasAfast === null || diasAfast > LIMITE_DIAS) {
      desatualizados.push({
        tipo: 'afastados',
        label: 'Afastados',
        ultima_atualizacao: cargaAfast?.[0]?.data_carga || null,
        dias_desde_atualizacao: diasAfast,
      });
    }

    if (desatualizados.length === 0) {
      console.log('[verificar-dados-desatualizados] ✅ Todos os dados estão atualizados');
      return new Response(
        JSON.stringify({ success: true, desatualizados: 0, message: 'Todos os dados estão atualizados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verificar-dados-desatualizados] ⚠️ ${desatualizados.length} tipo(s) desatualizado(s)`);

    // 2️⃣ BUSCAR ROLES QUE TÊM ACESSO ÀS TELAS DE ATUALIZAÇÃO
    const rotasRelevantes = [
      '/gestao-adm-integrantes-atualizacao',
      '/gestao-adm-inadimplencia',
      '/gestao-adm-aniversariantes',
      '/gestao-adm-afastamentos',
    ];

    const { data: screens } = await supabaseAdmin
      .from('system_screens')
      .select('id')
      .in('rota', rotasRelevantes)
      .eq('ativo', true);

    if (!screens || screens.length === 0) {
      console.log('[verificar-dados-desatualizados] ⚠️ Nenhuma tela de atualização configurada');
      return new Response(
        JSON.stringify({ success: true, desatualizados: desatualizados.length, emails_enviados: 0, message: 'Sem telas configuradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const screenIds = screens.map(s => s.id);
    const { data: permissions } = await supabaseAdmin
      .from('screen_permissions')
      .select('role')
      .in('screen_id', screenIds);

    const rolesComAcesso = [...new Set(permissions?.map(p => p.role) || [])];
    console.log(`[verificar-dados-desatualizados] 👥 Roles com acesso: ${rolesComAcesso.join(', ')}`);

    // 3️⃣ BUSCAR USUÁRIOS COM ESSAS ROLES
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .in('role', rolesComAcesso);

    const userIds = [...new Set(userRoles?.map(r => r.user_id) || [])];

    if (userIds.length === 0) {
      console.log('[verificar-dados-desatualizados] ⚠️ Nenhum usuário com as roles necessárias');
      return new Response(
        JSON.stringify({ success: true, desatualizados: desatualizados.length, emails_enviados: 0, message: 'Sem usuários para notificar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4️⃣ BUSCAR EMAILS DOS USUÁRIOS
    const emailPromises = userIds.map(async (id: string) => {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(id);
        return { userId: id, email: userData?.user?.email };
      } catch {
        return null;
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const destinatarios = emailResults.filter(r => r?.email) as { userId: string; email: string }[];

    if (destinatarios.length === 0) {
      console.log('[verificar-dados-desatualizados] ⚠️ Nenhum email encontrado');
      return new Response(
        JSON.stringify({ success: true, desatualizados: desatualizados.length, emails_enviados: 0, message: 'Sem emails para enviar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verificar-dados-desatualizados] 📧 Enviando para ${destinatarios.length} usuário(s)`);

    // 5️⃣ MONTAR E ENVIAR EMAIL
    const listaDesatualizados = desatualizados.map(d => {
      const dataStr = d.ultima_atualizacao
        ? new Date(d.ultima_atualizacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Nunca importado';
      const diasStr = d.dias_desde_atualizacao !== null ? `${d.dias_desde_atualizacao} dias atrás` : '';
      return `<li style="margin-bottom:8px;"><strong>${d.label}</strong> — Última atualização: ${dataStr} ${diasStr ? `(${diasStr})` : ''}</li>`;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #92400E; margin: 0 0 10px 0; font-size: 18px;">
            ⚠️ Dados Desatualizados no Portal
          </h2>
          <p style="color: #78350F; margin: 0; font-size: 14px;">
            Os seguintes dados estão sem atualização há mais de ${LIMITE_DIAS} dias:
          </p>
        </div>
        
        <ul style="padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.6;">
          ${listaDesatualizados}
        </ul>
        
        <div style="margin-top: 20px; padding: 16px; background: #F3F4F6; border-radius: 8px;">
          <p style="margin: 0; color: #6B7280; font-size: 13px;">
            Acesse <strong>Gestão ADM</strong> no portal para fazer a atualização dos dados.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin: 0;">
          Portal Regional VP1 — Notificação automática diária
        </p>
      </div>
    `;

    const text = `Dados Desatualizados no Portal\n\n${desatualizados.map(d => 
      `${d.label}: ${d.dias_desde_atualizacao !== null ? `${d.dias_desde_atualizacao} dias sem atualização` : 'nunca importado'}`
    ).join('\n')}\n\nAcesse Gestão ADM no portal para atualizar.`;

    const emails = destinatarios.map(d => d.email);

    const emailResult = await sendEmail({
      to: emails,
      subject: `⚠️ Portal VP1 – ${desatualizados.length} base(s) de dados desatualizada(s)`,
      html,
      text,
    }, {
      tipo: 'dados_desatualizados',
      to_nome: `${destinatarios.length} usuários`,
      metadata: {
        desatualizados: desatualizados.map(d => d.tipo),
        total_destinatarios: destinatarios.length,
      }
    });

    console.log(`[verificar-dados-desatualizados] ${emailResult.success ? '✅' : '❌'} Email: ${emailResult.success ? emailResult.messageId : emailResult.error}`);

    return new Response(
      JSON.stringify({
        success: true,
        desatualizados: desatualizados.length,
        detalhes: desatualizados,
        emails_enviados: emailResult.success ? destinatarios.length : 0,
        email_error: emailResult.error || null,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verificar-dados-desatualizados] ❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
