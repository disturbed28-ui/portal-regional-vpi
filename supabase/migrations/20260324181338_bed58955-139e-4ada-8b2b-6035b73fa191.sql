-- Add UPDATE RLS policy for directors on solicitacoes_estagio
CREATE POLICY "Diretores podem atualizar solicitacoes_estagio da regional"
ON solicitacoes_estagio FOR UPDATE
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM integrantes_portal meu
    WHERE meu.profile_id = (auth.uid())::text
      AND meu.ativo = true
      AND (
        lower(meu.cargo_grau_texto) LIKE '%diretor%regional%'
        OR lower(meu.cargo_grau_texto) LIKE '%diretor%divis_o%'
        OR lower(meu.cargo_grau_texto) LIKE '%diretor%divisao%'
      )
      AND meu.regional_id = solicitacoes_estagio.regional_id
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM integrantes_portal meu
    WHERE meu.profile_id = (auth.uid())::text
      AND meu.ativo = true
      AND (
        lower(meu.cargo_grau_texto) LIKE '%diretor%regional%'
        OR lower(meu.cargo_grau_texto) LIKE '%diretor%divis_o%'
        OR lower(meu.cargo_grau_texto) LIKE '%diretor%divisao%'
      )
      AND meu.regional_id = solicitacoes_estagio.regional_id
  ))
);