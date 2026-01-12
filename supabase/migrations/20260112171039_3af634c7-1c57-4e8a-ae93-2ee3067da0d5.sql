-- Remover policy restritiva atual
DROP POLICY IF EXISTS "Aprovador pode atualizar sua aprovacao" ON aprovacoes_treinamento;

-- Criar nova policy que permite:
-- 1. O aprovador original atualizar sua própria aprovação
-- 2. O Diretor Regional atualizar aprovações de integrantes da sua regional
CREATE POLICY "Aprovador ou DR pode atualizar aprovacao"
ON aprovacoes_treinamento FOR UPDATE
USING (
  -- Aprovador original pode atualizar sua aprovação
  aprovador_integrante_id IN (
    SELECT id FROM integrantes_portal WHERE profile_id = auth.uid()::text
  )
  OR
  -- Diretor Regional pode atualizar aprovações de integrantes da sua regional
  EXISTS (
    SELECT 1 
    FROM integrantes_portal meu
    JOIN solicitacoes_treinamento st ON st.id = aprovacoes_treinamento.solicitacao_id
    JOIN integrantes_portal integrante ON integrante.id = st.integrante_id
    WHERE meu.profile_id = auth.uid()::text
      AND LOWER(meu.cargo_grau_texto) LIKE '%diretor%regional%'
      AND meu.regional_id = integrante.regional_id
  )
)
WITH CHECK (
  -- Mesmas condições para o WITH CHECK
  aprovador_integrante_id IN (
    SELECT id FROM integrantes_portal WHERE profile_id = auth.uid()::text
  )
  OR
  EXISTS (
    SELECT 1 
    FROM integrantes_portal meu
    JOIN solicitacoes_treinamento st ON st.id = aprovacoes_treinamento.solicitacao_id
    JOIN integrantes_portal integrante ON integrante.id = st.integrante_id
    WHERE meu.profile_id = auth.uid()::text
      AND LOWER(meu.cargo_grau_texto) LIKE '%diretor%regional%'
      AND meu.regional_id = integrante.regional_id
  )
);