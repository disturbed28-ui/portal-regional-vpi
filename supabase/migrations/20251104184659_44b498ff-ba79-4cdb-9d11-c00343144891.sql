-- Atualizar política de INSERT para incluir diretor_divisao (com validação de divisão)
DROP POLICY IF EXISTS "Admins e moderadores podem registrar presenças" ON presencas;

CREATE POLICY "Admins, moderadores e diretores podem registrar presenças"
ON presencas
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid()::text, 'admin') 
  OR has_role(auth.uid()::text, 'moderator')
  OR (
    has_role(auth.uid()::text, 'diretor_divisao')
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN eventos_agenda e ON e.id = presencas.evento_agenda_id
      WHERE p.id = auth.uid()::text
      AND p.divisao_id = e.divisao_id
    )
  )
);

-- Atualizar política de DELETE para incluir diretor_divisao (com validação de divisão)
DROP POLICY IF EXISTS "Admins e moderadores podem remover presenças" ON presencas;

CREATE POLICY "Admins, moderadores e diretores podem remover presenças"
ON presencas
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid()::text, 'admin')
  OR has_role(auth.uid()::text, 'moderator')
  OR (
    has_role(auth.uid()::text, 'diretor_divisao')
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN eventos_agenda e ON e.id = presencas.evento_agenda_id
      WHERE p.id = auth.uid()::text
      AND p.divisao_id = e.divisao_id
    )
  )
);

-- Criar política de UPDATE para incluir diretor_divisao (com validação de divisão)
DROP POLICY IF EXISTS "Admins e moderadores podem atualizar presenças" ON presencas;

CREATE POLICY "Admins, moderadores e diretores podem atualizar presenças"
ON presencas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid()::text, 'admin')
  OR has_role(auth.uid()::text, 'moderator')
  OR (
    has_role(auth.uid()::text, 'diretor_divisao')
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN eventos_agenda e ON e.id = presencas.evento_agenda_id
      WHERE p.id = auth.uid()::text
      AND p.divisao_id = e.divisao_id
    )
  )
)
WITH CHECK (
  has_role(auth.uid()::text, 'admin')
  OR has_role(auth.uid()::text, 'moderator')
  OR (
    has_role(auth.uid()::text, 'diretor_divisao')
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN eventos_agenda e ON e.id = presencas.evento_agenda_id
      WHERE p.id = auth.uid()::text
      AND p.divisao_id = e.divisao_id
    )
  )
);