-- Adicionar colunas para motivo da baixa
ALTER TABLE integrantes_afastados 
ADD COLUMN IF NOT EXISTS motivo_baixa TEXT,
ADD COLUMN IF NOT EXISTS observacoes_baixa TEXT;

-- Comentários explicativos
COMMENT ON COLUMN integrantes_afastados.motivo_baixa IS 'retornou, desligamento, outro';
COMMENT ON COLUMN integrantes_afastados.observacoes_baixa IS 'Observações sobre a baixa do afastamento';

-- Permitir diretor_regional atualizar afastamentos da sua regional
DROP POLICY IF EXISTS "Admins podem atualizar afastamentos" ON integrantes_afastados;

CREATE POLICY "Admins e diretores podem atualizar afastamentos"
ON integrantes_afastados FOR UPDATE
USING (
  has_role(auth.uid()::text, 'admin'::app_role)
  OR (
    has_role(auth.uid()::text, 'diretor_regional'::app_role) 
    AND (
      divisao_id IN (
        SELECT d.id FROM profiles p
        JOIN divisoes d ON d.regional_id = p.regional_id
        WHERE p.id = auth.uid()::text
      )
      OR (
        divisao_id IS NULL 
        AND normalize_divisao_text(divisao_texto) IN (
          SELECT normalize_divisao_text(d.nome)
          FROM profiles p
          JOIN divisoes d ON d.regional_id = p.regional_id
          WHERE p.id = auth.uid()::text
        )
      )
    )
  )
);