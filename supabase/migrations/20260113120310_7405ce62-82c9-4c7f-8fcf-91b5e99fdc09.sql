-- Remover policy restritiva atual de INSERT
DROP POLICY IF EXISTS "Only admins can insert integrantes historico" ON integrantes_historico;

-- Nova policy: permitir INSERT para quem pode editar integrantes
CREATE POLICY "Usuarios autenticados podem inserir historico"
ON integrantes_historico FOR INSERT
WITH CHECK (
  -- Verificar se o usuário logado é o mesmo que está alterando
  auth.uid()::text = alterado_por
  AND (
    -- Admins podem tudo
    has_role(auth.uid()::text, 'admin')
    OR
    -- Diretores podem inserir histórico de integrantes da sua regional/divisão
    EXISTS (
      SELECT 1 
      FROM profiles p
      JOIN integrantes_portal ip ON ip.id = integrantes_historico.integrante_id
      WHERE p.id = auth.uid()::text
      AND (
        p.grau IN ('I', 'II', 'III', 'IV')
        OR (p.grau = 'V' AND ip.regional_id = p.regional_id)
        OR (p.grau NOT IN ('I', 'II', 'III', 'IV', 'V') AND ip.divisao_id = p.divisao_id)
      )
    )
  )
);