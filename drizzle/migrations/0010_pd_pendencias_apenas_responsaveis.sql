CREATE OR REPLACE FUNCTION public.pd_responsavel_pendencia(_cargo text, _grau text, _divisao_usuario uuid, _regional_usuario uuid, _divisao_pd uuid, _regional_pd uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
 SELECT COALESCE(
   (trim(public.unaccent(upper(_cargo))) IN ('DIRETOR DIVISAO', 'DIRETOR DIVISAO (GRAU VI)') AND _grau = 'VI' AND _divisao_usuario = _divisao_pd)
   OR (trim(public.unaccent(upper(_cargo))) IN ('DIRETOR REGIONAL', 'DIRETOR REGIONAL (GRAU V)', 'OPERACIONAL REGIONAL', 'OPERACIONAL REGIONAL (GRAU V)') AND _grau = 'V' AND _regional_usuario = _regional_pd), false);
$function$;
REVOKE ALL ON FUNCTION public.pd_responsavel_pendencia(text,text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pd_responsavel_pendencia(text,text,uuid,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pd_pendencias_responsavel()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
 SELECT COALESCE(jsonb_agg(item ORDER BY item->>'emitido_em' DESC), '[]'::jsonb)
 FROM (
  SELECT jsonb_build_object('id', pd.id, 'numero', pd.numero, 'ano', pd.ano, 'titulo', pd.titulo, 'status', pd.status, 'autor_nome', pd.autor_nome, 'divisao_texto', pd.divisao_texto, 'regional_texto', pd.regional_texto, 'emitido_em', pd.emitido_em, 'created_at', pd.created_at) AS item
  FROM public.processos_disciplinares pd
  JOIN public.divisoes d ON d.id = pd.divisao_id
  WHERE auth.uid() IS NOT NULL
   AND pd.status IN ('emitido', 'em_analise_regional', 'versao_regional_em_elaboracao', 'aguardando_devolutiva')
   AND public.user_has_screen_permission(auth.uid()::text, '/formularios/processo-disciplinar')
   AND EXISTS (
    SELECT 1 FROM public.integrantes_portal i
    WHERE i.profile_id = auth.uid()::text AND i.ativo = true
     AND public.pd_responsavel_pendencia(i.cargo_nome, i.grau, i.divisao_id, i.regional_id, d.id, d.regional_id)
   )
 ) permitted;
$function$;
REVOKE ALL ON FUNCTION public.pd_pendencias_responsavel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pd_pendencias_responsavel() TO authenticated, service_role;