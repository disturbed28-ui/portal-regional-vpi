DROP POLICY IF EXISTS "Admins, diretores, moderadores e regionais podem ver cargas" ON public.cargas_historico;
CREATE POLICY "Admins, diretores, moderadores e regionais podem ver cargas" ON public.cargas_historico
FOR SELECT USING (
  (SELECT has_role((auth.uid())::text, 'admin'::app_role)) OR
  (SELECT has_role((auth.uid())::text, 'diretor_regional'::app_role)) OR
  (SELECT has_role((auth.uid())::text, 'diretor_divisao'::app_role)) OR
  (SELECT has_role((auth.uid())::text, 'moderator'::app_role)) OR
  (SELECT has_role((auth.uid())::text, 'regional'::app_role))
);

CREATE OR REPLACE FUNCTION public.update_last_access_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualiza no máximo a cada 10 minutos para não disparar os gatilhos de perfil a cada tela aberta
  UPDATE profiles
  SET last_access_at = NEW.created_at
  WHERE id = NEW.user_id
    AND (last_access_at IS NULL OR last_access_at < NEW.created_at - INTERVAL '10 minutes');
  RETURN NEW;
END;
$function$;