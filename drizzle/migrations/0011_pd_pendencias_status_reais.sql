CREATE OR REPLACE FUNCTION public.pd_pendencias_responsavel()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
 SELECT COALESCE(jsonb_agg(item ORDER BY item->>'emitido_em' DESC), '[]'::jsonb)
 FROM (
  SELECT jsonb_build_object('id', pd.id, 'numero', pd.numero, 'ano', pd.ano, 'titulo', pd.titulo, 'status', pd.status, 'autor_nome', pd.autor_nome, 'divisao_texto', pd.divisao_texto, 'regional_texto', pd.regional_texto, 'emitido_em', pd.emitido_em, 'created_at', pd.created_at) AS item
  FROM public.processos_disciplinares pd
  JOIN public.divisoes d ON d.id = pd.divisao_id
  WHERE auth.uid() IS NOT NULL
   AND pd.status IN ('emitido', 'em_analise', 'versao_regional', 'aguardando_cmd')
   AND public.user_has_screen_permission(auth.uid()::text, '/formularios/processo-disciplinar')
   AND EXISTS (
    SELECT 1 FROM public.integrantes_portal i
    WHERE i.profile_id = auth.uid()::text AND i.ativo = true
     AND public.pd_responsavel_pendencia(i.cargo_nome, i.grau, i.divisao_id, i.regional_id, d.id, d.regional_id)
   )
 ) permitted;
$function$;