CREATE OR REPLACE FUNCTION public.cadastro_selecionar_destinatarios(_candidatos jsonb, _regional uuid, _responsavel text, _canal text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH disponiveis AS (
    SELECT c FROM jsonb_array_elements(_candidatos) c
    WHERE c->>'profile_status' = 'Ativo' AND (c->>'admin')::boolean IS TRUE
      AND CASE _canal
        WHEN 'whatsapp' THEN regexp_replace(coalesce(c->>'telefone',''), '[^0-9]', '', 'g') ~ '^([0-9]{10,11}|55[0-9]{10,11})$'
        WHEN 'email' THEN coalesce(c->>'email','') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ELSE false END
  ), locais AS (
    SELECT c FROM disponiveis WHERE _regional IS NOT NULL AND c->>'regional_id' = _regional::text
  )
  SELECT coalesce((SELECT jsonb_agg(c) FROM locais),
    (SELECT jsonb_agg(c) FROM disponiveis WHERE c->>'profile_id' = _responsavel), '[]'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.cadastro_selecionar_destinatarios(jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadastro_selecionar_destinatarios(jsonb,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cadastro_destinatarios(_user_id text, _canal text)
RETURNS TABLE(profile_id text, nome text, telefone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH origem AS (
    SELECT coalesce(i.regional_id, d.regional_id, p.regional_id) AS regional_id
    FROM public.profiles p
    LEFT JOIN public.integrantes_portal i ON i.profile_id = p.id AND i.ativo = true
    LEFT JOIN public.divisoes d ON d.id = p.divisao_id
    WHERE p.id = _user_id
  ), candidatos AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'profile_id',p.id, 'nome',coalesce(p.nome_colete,p.name),
      'telefone',p.telefone, 'email',p.email, 'profile_status',p.profile_status,
      'regional_id',coalesce(i.regional_id,d.regional_id,p.regional_id), 'admin',true
    )), '[]'::jsonb) AS dados
    FROM public.profiles p
    LEFT JOIN public.integrantes_portal i ON i.profile_id = p.id AND i.ativo = true
    LEFT JOIN public.divisoes d ON d.id = p.divisao_id
    WHERE p.id <> _user_id AND public.has_role(p.id,'admin')
      AND public.user_has_screen_permission(p.id,'/admin')
  ), selecionados AS (
    SELECT public.cadastro_selecionar_destinatarios(c.dados,o.regional_id,
      (SELECT valor_texto FROM public.system_settings WHERE chave = 'cadastro_admin_fallback_profile_id'),_canal) AS dados
    FROM candidatos c CROSS JOIN origem o
  )
  SELECT DISTINCT x->>'profile_id',x->>'nome',x->>'telefone',x->>'email'
  FROM selecionados s CROSS JOIN LATERAL jsonb_array_elements(s.dados) x
$$;
REVOKE ALL ON FUNCTION public.cadastro_destinatarios(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadastro_destinatarios(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_admins_contato()
RETURNS TABLE(profile_id text, nome text, telefone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.profile_id,d.nome,d.telefone
  FROM public.cadastro_destinatarios(auth.uid()::text,'whatsapp') d
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_admins_contato() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admins_contato() TO authenticated, service_role;