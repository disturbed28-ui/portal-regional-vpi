-- Remover políticas antigas
DROP POLICY IF EXISTS "Diretores e Grau V podem criar eventos" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Diretores e Grau V podem atualizar eventos" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Diretores e Grau V podem registrar presenças" ON public.presencas;
DROP POLICY IF EXISTS "Diretores e Grau V podem remover presenças" ON public.presencas;

-- Criar novas políticas usando roles
CREATE POLICY "Admins e moderadores podem criar eventos"
  ON public.eventos_agenda FOR INSERT
  WITH CHECK (
    has_role((auth.uid())::text, 'admin'::app_role) OR 
    has_role((auth.uid())::text, 'moderator'::app_role)
  );

CREATE POLICY "Admins e moderadores podem atualizar eventos"
  ON public.eventos_agenda FOR UPDATE
  USING (
    has_role((auth.uid())::text, 'admin'::app_role) OR 
    has_role((auth.uid())::text, 'moderator'::app_role)
  );

CREATE POLICY "Admins e moderadores podem registrar presenças"
  ON public.presencas FOR INSERT
  WITH CHECK (
    has_role((auth.uid())::text, 'admin'::app_role) OR 
    has_role((auth.uid())::text, 'moderator'::app_role)
  );

CREATE POLICY "Admins e moderadores podem remover presenças"
  ON public.presencas FOR DELETE
  USING (
    has_role((auth.uid())::text, 'admin'::app_role) OR 
    has_role((auth.uid())::text, 'moderator'::app_role)
  );