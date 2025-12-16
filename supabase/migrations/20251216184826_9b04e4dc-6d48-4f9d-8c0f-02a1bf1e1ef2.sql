-- Atualizar política RLS de integrantes_afastados para usar comparação normalizada
-- Problema: divisao_texto pode ter formato diferente (ex: "São José dos Campos Norte - SP" vs "Divisao Sao Jose dos Campos Norte - SP")

-- Remover política antiga que usa comparação exata
DROP POLICY IF EXISTS "usuarios_regional_podem_ver" ON integrantes_afastados;

-- Criar nova política com comparação normalizada (case-insensitive e sem acentos)
CREATE POLICY "usuarios_regional_podem_ver" ON integrantes_afastados
FOR SELECT USING (
  (
    has_role(auth.uid()::text, 'regional'::app_role) OR 
    has_role(auth.uid()::text, 'moderator'::app_role) OR 
    has_role(auth.uid()::text, 'diretor_regional'::app_role) OR 
    has_role(auth.uid()::text, 'diretor_divisao'::app_role)
  ) 
  AND (
    -- Comparação normalizada: remove acentos e converte para maiúsculo
    unaccent(upper(divisao_texto)) IN (
      SELECT unaccent(upper(d.nome))
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = auth.uid()::text
    )
    OR 
    -- Fallback: comparação por divisao_id se disponível
    divisao_id IN (
      SELECT d.id
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = auth.uid()::text
    )
  )
);