-- Criar policy de UPDATE para permitir baixa manual por admins
CREATE POLICY "Admins podem atualizar mensalidades"
ON mensalidades_atraso FOR UPDATE
USING (has_role(auth.uid()::text, 'admin'))
WITH CHECK (has_role(auth.uid()::text, 'admin'));

-- Criar policy de UPDATE para Diretores Regionais/Divisão atualizarem registros da sua regional
CREATE POLICY "Diretores podem atualizar mensalidades da regional"
ON mensalidades_atraso FOR UPDATE
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