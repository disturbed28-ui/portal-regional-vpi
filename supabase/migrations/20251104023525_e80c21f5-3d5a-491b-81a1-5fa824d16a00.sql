-- Criar função para atribuir automaticamente role moderator para Grau VI
CREATE OR REPLACE FUNCTION public.auto_assign_moderator_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o grau mudou para VI, adicionar role moderator
  IF NEW.grau = 'VI' AND (OLD.grau IS NULL OR OLD.grau != 'VI') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'moderator')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Role moderator atribuída ao usuário % (Grau VI)', NEW.id;
  END IF;
  
  -- Se o grau mudou de VI para outro, remover role moderator (mas manter se for admin)
  IF OLD.grau = 'VI' AND NEW.grau != 'VI' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id 
      AND role = 'moderator'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = NEW.id AND role = 'admin'
      );
    
    RAISE NOTICE 'Role moderator removida do usuário % (não é mais Grau VI)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atribuição automática
DROP TRIGGER IF EXISTS auto_assign_moderator_on_profile_update ON public.profiles;
CREATE TRIGGER auto_assign_moderator_on_profile_update
AFTER INSERT OR UPDATE OF grau ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_moderator_role();

-- Atribuir role moderator para todos os usuários existentes com Grau VI
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator'
FROM public.profiles
WHERE grau = 'VI'
ON CONFLICT (user_id, role) DO NOTHING;

-- Atualizar política RLS em presencas para moderadores verem apenas suas divisões
DROP POLICY IF EXISTS "Moderadores podem ver presencas de sua divisao" ON public.presencas;
CREATE POLICY "Moderadores podem ver presencas de sua divisao"
ON public.presencas
FOR SELECT
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR
  (
    has_role((auth.uid())::text, 'moderator'::app_role) AND
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      JOIN public.eventos_agenda e ON e.id = presencas.evento_agenda_id
      WHERE p.id = (auth.uid())::text
        AND p.divisao_id = e.divisao_id
    )
  )
);

-- Registrar nova tela no sistema
INSERT INTO public.system_screens (nome, rota, descricao, icone, ordem, ativo)
VALUES (
  'Listas de Presença',
  '/listas-presenca',
  'Consulta de listas de presença e dashboard de frequência',
  'ClipboardList',
  7,
  true
)
ON CONFLICT (rota) DO NOTHING;

-- Adicionar permissões para a nova tela
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'admin'
FROM public.system_screens
WHERE rota = '/listas-presenca'
ON CONFLICT DO NOTHING;

INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'moderator'
FROM public.system_screens
WHERE rota = '/listas-presenca'
ON CONFLICT DO NOTHING;