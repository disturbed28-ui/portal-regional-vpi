-- 1. Atualizar RLS de atualizacoes_carga para incluir regional
DROP POLICY IF EXISTS "Admins e moderadores podem ver atualizacoes" ON public.atualizacoes_carga;

CREATE POLICY "Admins, moderadores e regionais podem ver atualizacoes" ON public.atualizacoes_carga
FOR SELECT USING (
  has_role(auth.uid()::text, 'admin'::app_role)
  OR has_role(auth.uid()::text, 'moderator'::app_role)
  OR has_role(auth.uid()::text, 'regional'::app_role)
  OR has_role(auth.uid()::text, 'diretor_regional'::app_role)
);

-- 2. Atualizar RLS de cargas_historico para incluir regional
DROP POLICY IF EXISTS "Admins, diretores e moderadores podem ver cargas" ON public.cargas_historico;

CREATE POLICY "Admins, diretores, moderadores e regionais podem ver cargas" ON public.cargas_historico
FOR SELECT USING (
  has_role(auth.uid()::text, 'admin'::app_role)
  OR has_role(auth.uid()::text, 'diretor_regional'::app_role)
  OR has_role(auth.uid()::text, 'moderator'::app_role)
  OR has_role(auth.uid()::text, 'regional'::app_role)
);