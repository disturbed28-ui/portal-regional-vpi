DROP POLICY IF EXISTS "Designated approver or admin can update aprovacoes_estagio" ON public.aprovacoes_estagio;

CREATE POLICY "Aprovador, DR ou admin pode atualizar aprovacoes_estagio"
ON public.aprovacoes_estagio
FOR UPDATE
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR has_role((auth.uid())::text, 'comando'::app_role)
  OR aprovador_integrante_id IN (
    SELECT ip.id FROM public.integrantes_portal ip WHERE ip.profile_id = (auth.uid())::text
  )
  OR EXISTS (
    SELECT 1
    FROM public.integrantes_portal meu
    JOIN public.solicitacoes_estagio se ON se.id = aprovacoes_estagio.solicitacao_id
    JOIN public.integrantes_portal alvo ON alvo.id = se.integrante_id
    WHERE meu.profile_id = (auth.uid())::text
      AND lower(meu.cargo_grau_texto) LIKE '%diretor%regional%'
      AND meu.regional_id = alvo.regional_id
  )
)
WITH CHECK (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR has_role((auth.uid())::text, 'comando'::app_role)
  OR aprovador_integrante_id IN (
    SELECT ip.id FROM public.integrantes_portal ip WHERE ip.profile_id = (auth.uid())::text
  )
  OR EXISTS (
    SELECT 1
    FROM public.integrantes_portal meu
    JOIN public.solicitacoes_estagio se ON se.id = aprovacoes_estagio.solicitacao_id
    JOIN public.integrantes_portal alvo ON alvo.id = se.integrante_id
    WHERE meu.profile_id = (auth.uid())::text
      AND lower(meu.cargo_grau_texto) LIKE '%diretor%regional%'
      AND meu.regional_id = alvo.regional_id
  )
);