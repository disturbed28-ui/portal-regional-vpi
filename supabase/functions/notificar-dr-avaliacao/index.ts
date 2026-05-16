import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email-service.ts';

/**
 * Notifica os Diretores Regionais quando o Diretor de Divisão conclui
 * a avaliação de um integrante (etapa "divisao") e o caso fica pendente
 * para validação regional.
 *
 * Body: { periodo_id, integrante_id, decisao_dd, nota, decidido_por_nome }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { periodo_id, integrante_id, decisao_dd, nota, decidido_por_nome } = await req.json();

    if (!periodo_id || !integrante_id) {
      return new Response(JSON.stringify({ error: 'parâmetros inválidos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Integrante
    const { data: integrante } = await supabase
      .from('integrantes_portal')
      .select('id, nome_colete, regional_id, regional_texto, divisao_texto')
      .eq('id', integrante_id)
      .maybeSingle();

    if (!integrante?.regional_id) {
      return new Response(JSON.stringify({ ok: false, motivo: 'integrante sem regional' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Período
    const { data: periodo } = await supabase
      .from('avaliacao_periodos')
      .select('nome, ano, semestre')
      .eq('id', periodo_id)
      .maybeSingle();

    // Diretores Regionais: profiles com role diretor_regional na mesma regional
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'diretor_regional');

    const drIds = (roles || []).map((r: any) => r.user_id);
    if (drIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: 'sem DR' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: drs } = await supabase
      .from('profiles')
      .select('id, name, nome_colete')
      .in('id', drIds)
      .eq('regional_id', integrante.regional_id)
      .eq('profile_status', 'Ativo');

    if (!drs || drs.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: 'sem DR ativo na regional' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar emails via auth
    const emails: { email: string; nome: string; id: string }[] = [];
    for (const dr of drs) {
      const { data: u } = await supabase.auth.admin.getUserById(dr.id);
      if (u?.user?.email) emails.push({ email: u.user.email, nome: dr.nome_colete || dr.name || 'Diretor', id: dr.id });
    }
    if (emails.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: 'sem email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const periodoLabel = periodo?.nome || `${periodo?.ano}/${periodo?.semestre}`;
    const decisaoLabel = decisao_dd === 'aprovado' ? 'APROVADO' : 'REPROVADO';
    const corDecisao = decisao_dd === 'aprovado' ? '#16a34a' : '#dc2626';

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;color:#222">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;color:#111">Avaliação aguardando validação regional</h2>
    <p style="margin:0 0 16px">Olá <strong>${emails[0].nome}</strong>,</p>
    <p style="margin:0 0 16px">O Diretor de Divisão concluiu a avaliação de um integrante da sua regional. Sua validação é necessária para encerrar o processo.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Integrante</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${integrante.nome_colete}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Divisão</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${integrante.divisao_texto || '-'}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Período</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${periodoLabel}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Nota</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${Number(nota || 0).toFixed(1)}%</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Decisão DD</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:${corDecisao};font-weight:bold">${decisaoLabel}</td></tr>
      ${decidido_por_nome ? `<tr><td style="padding:8px"><strong>Avaliador</strong></td><td style="padding:8px">${decidido_por_nome}</td></tr>` : ''}
    </table>
    <p style="margin:16px 0"><a href="https://vp1.app.br/avaliacao" style="background:#0f3460;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Abrir avaliação</a></p>
    <p style="margin:24px 0 0;font-size:12px;color:#666">Portal Regional VP1 — Notificação automática.</p>
  </div>
</body></html>`.trim();

    let enviados = 0;
    for (const dst of emails) {
      const r = await sendEmail(
        {
          to: dst.email,
          subject: `Avaliação aguardando sua validação — ${integrante.nome_colete}`,
          html,
        },
        {
          tipo: 'avaliacao_pendente_dr',
          to_nome: dst.nome,
          related_user_id: dst.id,
          metadata: { periodo_id, integrante_id, decisao_dd, nota },
        },
      );
      if (r.success) enviados++;
    }

    return new Response(JSON.stringify({ ok: true, enviados, total: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[notificar-dr-avaliacao] erro:', e);
    return new Response(JSON.stringify({ error: e?.message || 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
