-- Remover policy restritiva atual
DROP POLICY IF EXISTS "Only admins can view integrantes historico" ON integrantes_historico;

-- Nova policy: visibilidade baseada no grau do usuário
CREATE POLICY "Usuarios podem ver historico conforme grau"
ON integrantes_historico FOR SELECT
USING (
  -- Admins veem tudo
  has_role(auth.uid()::text, 'admin')
  OR
  -- Outros: ver apenas integrantes da regional/divisão visível
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN integrantes_portal ip ON ip.id = integrantes_historico.integrante_id
    WHERE p.id = auth.uid()::text
    AND (
      -- Grau I-IV: vê tudo (nenhum filtro adicional)
      p.grau IN ('I', 'II', 'III', 'IV')
      OR
      -- Grau V: vê sua regional
      (p.grau = 'V' AND ip.regional_id = p.regional_id)
      OR
      -- Grau VI+: vê sua divisão
      (p.grau NOT IN ('I', 'II', 'III', 'IV', 'V') AND ip.divisao_id = p.divisao_id)
    )
  )
);