-- Remover policy antiga de UPDATE
DROP POLICY IF EXISTS "Usuarios podem atualizar seus relatorios semanais" ON relatorios_semanais_divisao;

-- Criar policy mais flexível: qualquer membro da regional pode atualizar relatórios dessa regional
CREATE POLICY "Usuarios podem atualizar relatorios da sua regional"
ON relatorios_semanais_divisao
FOR UPDATE
USING (
  regional_relatorio_id IN (
    SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
  )
)
WITH CHECK (
  profile_id = (auth.uid())::text
  AND 
  regional_relatorio_id IN (
    SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
  )
);

-- Adicionar permissão de DELETE para admins
CREATE POLICY "Admins podem deletar relatorios"
ON relatorios_semanais_divisao
FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));