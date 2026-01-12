-- 1. Policy para Diretores atualizarem solicitações da sua regional
CREATE POLICY "Diretores podem atualizar solicitacoes da regional"
ON solicitacoes_treinamento FOR UPDATE
USING (
  (has_role(auth.uid()::text, 'diretor_regional') OR 
   has_role(auth.uid()::text, 'diretor_divisao'))
  AND
  regional_id IN (
    SELECT p.regional_id 
    FROM profiles p
    WHERE p.id = auth.uid()::text
  )
)
WITH CHECK (
  (has_role(auth.uid()::text, 'diretor_regional') OR 
   has_role(auth.uid()::text, 'diretor_divisao'))
  AND
  regional_id IN (
    SELECT p.regional_id 
    FROM profiles p
    WHERE p.id = auth.uid()::text
  )
);

-- 2. Policy para Diretores atualizarem integrantes da sua regional
CREATE POLICY "Diretores podem atualizar integrantes da regional"
ON integrantes_portal FOR UPDATE
USING (
  (has_role(auth.uid()::text, 'diretor_regional') OR 
   has_role(auth.uid()::text, 'diretor_divisao'))
  AND
  regional_id IN (
    SELECT p.regional_id 
    FROM profiles p
    WHERE p.id = auth.uid()::text
  )
)
WITH CHECK (
  (has_role(auth.uid()::text, 'diretor_regional') OR 
   has_role(auth.uid()::text, 'diretor_divisao'))
  AND
  regional_id IN (
    SELECT p.regional_id 
    FROM profiles p
    WHERE p.id = auth.uid()::text
  )
);

-- 3. Corrigir solicitação do Pereira que ficou travada
UPDATE solicitacoes_treinamento 
SET status = 'Em Treinamento', data_aprovacao = NOW() 
WHERE id = '530c2467-fed1-4cfd-bf17-60b64b9dfb49'
  AND status = 'Em Aprovacao';

-- 4. Atualizar cargo_treinamento do integrante Pereira
UPDATE integrantes_portal 
SET cargo_treinamento_id = (
  SELECT cargo_treinamento_id 
  FROM solicitacoes_treinamento 
  WHERE id = '530c2467-fed1-4cfd-bf17-60b64b9dfb49'
)
WHERE id = (
  SELECT integrante_id 
  FROM solicitacoes_treinamento 
  WHERE id = '530c2467-fed1-4cfd-bf17-60b64b9dfb49'
);