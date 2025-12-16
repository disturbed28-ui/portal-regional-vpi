-- 1. Criar função SQL de normalização de divisão para uso em RLS
CREATE OR REPLACE FUNCTION public.normalize_divisao_text(texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN UPPER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          UNACCENT(COALESCE(texto, '')),
          '^\s*DIVISAO\s*', '', 'i'
        ),
        '\s*-\s*SP\s*$', '', 'i'
      )
    )
  );
END;
$$;

-- 2. Atualizar RLS de integrantes_afastados com normalização robusta
DROP POLICY IF EXISTS "usuarios_regional_podem_ver" ON public.integrantes_afastados;

CREATE POLICY "usuarios_regional_podem_ver" ON public.integrantes_afastados
FOR SELECT USING (
  (
    has_role(auth.uid()::text, 'regional'::app_role) 
    OR has_role(auth.uid()::text, 'moderator'::app_role)
    OR has_role(auth.uid()::text, 'diretor_regional'::app_role)
    OR has_role(auth.uid()::text, 'diretor_divisao'::app_role)
  )
  AND (
    -- Comparação normalizada do texto de divisão
    normalize_divisao_text(divisao_texto) IN (
      SELECT normalize_divisao_text(d.nome)
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = auth.uid()::text
    )
    -- OU comparação por divisao_id se existir
    OR divisao_id IN (
      SELECT d.id
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = auth.uid()::text
    )
    -- OU comparação usando nome_ascii da divisão
    OR unaccent(upper(divisao_texto)) IN (
      SELECT unaccent(upper(d.nome_ascii))
      FROM profiles p
      JOIN divisoes d ON d.regional_id = p.regional_id
      WHERE p.id = auth.uid()::text
      AND d.nome_ascii IS NOT NULL
    )
  )
);

-- 3. Corrigir a role do Pacheco: de diretor_divisao para regional
UPDATE public.user_roles
SET role = 'regional'::app_role
WHERE user_id = 'ce1ef950-7539-4376-ad02-62592a717aad'
AND role = 'diretor_divisao'::app_role;