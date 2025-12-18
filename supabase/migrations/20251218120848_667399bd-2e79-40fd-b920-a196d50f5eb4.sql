-- Corrigir RLS de integrantes_afastados: separar diretor_divisao dos demais

-- 1. Dropar a política antiga que mistura as roles
DROP POLICY IF EXISTS "usuarios_regional_podem_ver" ON public.integrantes_afastados;

-- 2. Criar política para REGIONAIS (Grau V): veem todas divisões da sua regional
-- Inclui: regional, moderator, diretor_regional
CREATE POLICY "regionais_veem_sua_regional" 
ON public.integrantes_afastados
FOR SELECT
USING (
  (
    has_role((auth.uid())::text, 'regional'::app_role) OR 
    has_role((auth.uid())::text, 'moderator'::app_role) OR
    has_role((auth.uid())::text, 'diretor_regional'::app_role)
  )
  AND (
    -- Verificar se a divisão do afastado pertence à regional do usuário
    divisao_id IN (
      SELECT d.id 
      FROM profiles p 
      JOIN divisoes d ON d.regional_id = p.regional_id 
      WHERE p.id = (auth.uid())::text
    )
    OR 
    -- Fallback por texto normalizado quando divisao_id é null
    (divisao_id IS NULL AND normalize_divisao_text(divisao_texto) IN (
      SELECT normalize_divisao_text(d.nome) 
      FROM profiles p 
      JOIN divisoes d ON d.regional_id = p.regional_id 
      WHERE p.id = (auth.uid())::text
    ))
  )
);

-- 3. Criar política para DIRETOR DE DIVISÃO (Grau VI): vê SOMENTE sua divisão
CREATE POLICY "diretores_divisao_veem_sua_divisao" 
ON public.integrantes_afastados
FOR SELECT
USING (
  has_role((auth.uid())::text, 'diretor_divisao'::app_role)
  AND (
    -- Verificar se a divisão do afastado é a mesma do usuário
    divisao_id IN (
      SELECT p.divisao_id 
      FROM profiles p 
      WHERE p.id = (auth.uid())::text AND p.divisao_id IS NOT NULL
    )
    OR 
    -- Fallback por texto normalizado quando divisao_id é null
    (divisao_id IS NULL AND normalize_divisao_text(divisao_texto) IN (
      SELECT normalize_divisao_text(d.nome) 
      FROM profiles p 
      JOIN divisoes d ON d.id = p.divisao_id 
      WHERE p.id = (auth.uid())::text
    ))
  )
);