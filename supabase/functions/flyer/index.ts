import { createClient } from 'npm:@supabase/supabase-js@2';

// Redireciona links curtos de flyer (vp1.app.br/flyer/:code) para a URL
// assinada do arquivo no bucket privado agenda-flyers. Função pública:
// o link circula em convites de WhatsApp para pessoas sem login no portal.

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Aceita /flyer/ABC123 e também ?c=ABC123
  const partes = url.pathname.split('/').filter(Boolean);
  const code = (partes[partes.length - 1] || url.searchParams.get('c') || '').trim();

  if (!code || code.toLowerCase() === 'flyer') {
    return new Response('Link de flyer inválido', { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: flyer } = await supabaseAdmin
    .from('agenda_flyers')
    .select('storage_path')
    .eq('code', code)
    .maybeSingle();

  if (!flyer) {
    return new Response('Flyer não encontrado', { status: 404 });
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from('agenda-flyers')
    .createSignedUrl(flyer.storage_path, 60 * 60); // 1 hora

  if (error || !signed?.signedUrl) {
    console.error('[flyer] Erro ao assinar URL:', error);
    return new Response('Falha ao abrir o flyer', { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: signed.signedUrl, 'Cache-Control': 'no-store' },
  });
});
