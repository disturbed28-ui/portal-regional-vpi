-- ====================================
-- Corrigir RLS para Pendências
-- Separar políticas de admin e outras roles
-- ====================================

-- 1. TABELA mensalidades_atraso
-- Remover política antiga
DROP POLICY IF EXISTS "Admins, diretores e regionais podem ver mensalidades" ON mensalidades_atraso;

-- Criar política para admins (sem filtro)
CREATE POLICY "admins_podem_ver_todas"
ON mensalidades_atraso FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
);

-- Criar política para regional/diretor (com filtro de divisão)
CREATE POLICY "usuarios_regional_podem_ver"
ON mensalidades_atraso FOR SELECT
TO authenticated
USING (
  (
    has_role((auth.uid())::text, 'regional'::app_role) OR
    has_role((auth.uid())::text, 'diretor_regional'::app_role) OR
    has_role((auth.uid())::text, 'diretor_divisao'::app_role)
  )
  AND
  divisao_texto IN (
    SELECT d.nome
    FROM profiles p
    JOIN divisoes d ON d.regional_id = p.regional_id
    WHERE p.id = (auth.uid())::text
  )
);

-- 2. TABELA integrantes_afastados
-- Remover política antiga
DROP POLICY IF EXISTS "Admins, moderadores e regionais podem ver afastamentos" ON integrantes_afastados;

-- Criar política para admins (sem filtro)
CREATE POLICY "admins_podem_ver_todas"
ON integrantes_afastados FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
);

-- Criar política para regional/moderador/diretor (com filtro de divisão)
CREATE POLICY "usuarios_regional_podem_ver"
ON integrantes_afastados FOR SELECT
TO authenticated
USING (
  (
    has_role((auth.uid())::text, 'regional'::app_role) OR
    has_role((auth.uid())::text, 'moderator'::app_role) OR
    has_role((auth.uid())::text, 'diretor_regional'::app_role) OR
    has_role((auth.uid())::text, 'diretor_divisao'::app_role)
  )
  AND
  divisao_texto IN (
    SELECT d.nome
    FROM profiles p
    JOIN divisoes d ON d.regional_id = p.regional_id
    WHERE p.id = (auth.uid())::text
  )
);