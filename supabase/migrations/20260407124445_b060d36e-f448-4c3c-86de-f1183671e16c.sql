
-- 1. Popular regional_id e divisao_id baseado no divisao_texto
UPDATE mensalidades_atraso ma
SET 
  divisao_id = d.id,
  regional_id = d.regional_id
FROM divisoes d
WHERE ma.divisao_id IS NULL
  AND upper(trim(d.nome)) = upper(trim(ma.divisao_texto));

-- 2. Criar trigger para popular automaticamente no INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.fn_mensalidades_set_regional()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.divisao_id IS NULL THEN
    SELECT d.id, d.regional_id
    INTO NEW.divisao_id, NEW.regional_id
    FROM divisoes d
    WHERE upper(trim(d.nome)) = upper(trim(NEW.divisao_texto))
    LIMIT 1;
  ELSIF NEW.regional_id IS NULL AND NEW.divisao_id IS NOT NULL THEN
    SELECT d.regional_id INTO NEW.regional_id
    FROM divisoes d WHERE d.id = NEW.divisao_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensalidades_set_regional ON mensalidades_atraso;
CREATE TRIGGER trg_mensalidades_set_regional
  BEFORE INSERT OR UPDATE ON mensalidades_atraso
  FOR EACH ROW
  EXECUTE FUNCTION fn_mensalidades_set_regional();

-- 3. Atualizar policy de UPDATE para incluir adm_regional
DROP POLICY IF EXISTS "Diretores podem atualizar mensalidades da regional" ON mensalidades_atraso;
CREATE POLICY "Diretores podem atualizar mensalidades da regional"
  ON mensalidades_atraso
  FOR UPDATE
  TO authenticated
  USING (
    (
      has_role((auth.uid())::text, 'diretor_regional'::app_role)
      OR has_role((auth.uid())::text, 'diretor_divisao'::app_role)
      OR has_role((auth.uid())::text, 'adm_regional'::app_role)
    )
    AND regional_id IN (
      SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
    )
  )
  WITH CHECK (
    (
      has_role((auth.uid())::text, 'diretor_regional'::app_role)
      OR has_role((auth.uid())::text, 'diretor_divisao'::app_role)
      OR has_role((auth.uid())::text, 'adm_regional'::app_role)
    )
    AND regional_id IN (
      SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
    )
  );
