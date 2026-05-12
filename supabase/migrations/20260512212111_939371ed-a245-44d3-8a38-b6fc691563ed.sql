
-- 1. integrantes_portal: remover acesso público, exigir autenticação
DROP POLICY IF EXISTS "Public read access to integrantes_portal" ON public.integrantes_portal;
CREATE POLICY "Authenticated users can view integrantes_portal"
ON public.integrantes_portal
FOR SELECT
TO authenticated
USING (true);

-- 2. acoes_sociais_config_regional: remover acesso público, exigir autenticação
DROP POLICY IF EXISTS "Todos podem ver configurações" ON public.acoes_sociais_config_regional;
CREATE POLICY "Authenticated users can view configurações acoes sociais"
ON public.acoes_sociais_config_regional
FOR SELECT
TO authenticated
USING (true);

-- 3. aprovacoes_estagio: restringir UPDATE ao aprovador designado ou admin
DROP POLICY IF EXISTS "Authenticated can update aprovacoes_estagio" ON public.aprovacoes_estagio;
CREATE POLICY "Designated approver or admin can update aprovacoes_estagio"
ON public.aprovacoes_estagio
FOR UPDATE
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR aprovador_integrante_id IN (
    SELECT ip.id FROM public.integrantes_portal ip
    WHERE ip.profile_id = (auth.uid())::text
  )
)
WITH CHECK (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR aprovador_integrante_id IN (
    SELECT ip.id FROM public.integrantes_portal ip
    WHERE ip.profile_id = (auth.uid())::text
  )
);
