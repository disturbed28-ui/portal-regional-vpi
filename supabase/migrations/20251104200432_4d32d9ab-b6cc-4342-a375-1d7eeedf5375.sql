-- Corrigir RLS policies para permitir que regionais vejam pendências

-- 1. Atualizar policy de mensalidades_atraso
DROP POLICY IF EXISTS "Admins e diretores podem ver mensalidades" ON mensalidades_atraso;

CREATE POLICY "Admins, diretores e regionais podem ver mensalidades"
ON mensalidades_atraso
FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR
  has_role((auth.uid())::text, 'diretor_regional'::app_role) OR
  has_role((auth.uid())::text, 'regional'::app_role)
);

-- 2. Atualizar policy de integrantes_afastados
DROP POLICY IF EXISTS "Moderadores podem ver afastamentos" ON integrantes_afastados;

CREATE POLICY "Admins, moderadores e regionais podem ver afastamentos"
ON integrantes_afastados
FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR
  has_role((auth.uid())::text, 'moderator'::app_role) OR
  has_role((auth.uid())::text, 'regional'::app_role)
);