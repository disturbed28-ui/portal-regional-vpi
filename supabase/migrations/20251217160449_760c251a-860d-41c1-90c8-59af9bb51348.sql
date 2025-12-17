-- Atualizar política RLS de cargas_historico para incluir diretor_divisao
-- Isso permite que Grau VI veja a aba Evolução da sua regional

DROP POLICY IF EXISTS "Admins, diretores, moderadores e regionais podem ver cargas" ON cargas_historico;

CREATE POLICY "Admins, diretores, moderadores e regionais podem ver cargas"
ON cargas_historico
FOR SELECT
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR 
  has_role((auth.uid())::text, 'diretor_regional'::app_role) OR 
  has_role((auth.uid())::text, 'diretor_divisao'::app_role) OR
  has_role((auth.uid())::text, 'moderator'::app_role) OR 
  has_role((auth.uid())::text, 'regional'::app_role)
);