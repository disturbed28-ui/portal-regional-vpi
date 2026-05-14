
-- ============================================================
-- MÓDULO: Avaliação de Integrantes
-- ============================================================

-- 1) Helper function: verifica se usuário tem permissão para uma rota via screen_permissions
CREATE OR REPLACE FUNCTION public.user_has_screen_permission(_user_id text, _rota text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_screens s
    JOIN public.screen_permissions sp ON sp.screen_id = s.id
    JOIN public.user_roles ur ON ur.role = sp.role
    WHERE s.rota = _rota
      AND s.ativo = true
      AND ur.user_id = _user_id
  )
$$;

-- 2) Helper: retorna grau numérico do usuário (1..N)
CREATE OR REPLACE FUNCTION public.user_grau_num(_user_id text)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(p.grau,''))
    WHEN 'I' THEN 1 WHEN 'II' THEN 2 WHEN 'III' THEN 3 WHEN 'IV' THEN 4
    WHEN 'V' THEN 5 WHEN 'VI' THEN 6 WHEN 'VII' THEN 7 WHEN 'VIII' THEN 8
    ELSE 999 END
  FROM public.profiles p WHERE p.id = _user_id
$$;

-- ============================================================
-- TABELA: avaliacao_periodos
-- ============================================================
CREATE TABLE public.avaliacao_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_id uuid NOT NULL,
  nome text NOT NULL,
  ano int NOT NULL,
  semestre int NOT NULL CHECK (semestre IN (1,2)),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','encerrado')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  criado_por text,
  encerrado_por text,
  encerrado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regional_id, ano, semestre)
);

CREATE INDEX idx_avaliacao_periodos_regional ON public.avaliacao_periodos(regional_id);
CREATE INDEX idx_avaliacao_periodos_status ON public.avaliacao_periodos(status);

ALTER TABLE public.avaliacao_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver periodos da sua regional ou todos (Grau I-IV)"
ON public.avaliacao_periodos FOR SELECT TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR public.user_grau_num((auth.uid())::text) <= 4
  OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
);

CREATE POLICY "Gestores podem inserir periodos"
ON public.avaliacao_periodos FOR INSERT TO authenticated
WITH CHECK (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    public.user_has_screen_permission((auth.uid())::text, '/gestao-adm/periodos-avaliacao')
    AND (
      public.user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);

CREATE POLICY "Gestores podem atualizar periodos"
ON public.avaliacao_periodos FOR UPDATE TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    public.user_has_screen_permission((auth.uid())::text, '/gestao-adm/periodos-avaliacao')
    AND (
      public.user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);

CREATE POLICY "Apenas admin pode deletar periodo"
ON public.avaliacao_periodos FOR DELETE TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE TRIGGER trg_avaliacao_periodos_updated_at
BEFORE UPDATE ON public.avaliacao_periodos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA: criterios_avaliacao
-- ============================================================
CREATE TABLE public.criterios_avaliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_criterios_avaliacao_regional ON public.criterios_avaliacao(regional_id);
CREATE INDEX idx_criterios_avaliacao_ativo ON public.criterios_avaliacao(ativo);

ALTER TABLE public.criterios_avaliacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver criterios da sua regional"
ON public.criterios_avaliacao FOR SELECT TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR public.user_grau_num((auth.uid())::text) <= 4
  OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
);

CREATE POLICY "Gestores podem inserir criterios"
ON public.criterios_avaliacao FOR INSERT TO authenticated
WITH CHECK (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    public.user_has_screen_permission((auth.uid())::text, '/gestao-adm/criterios-avaliacao')
    AND (
      public.user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);

CREATE POLICY "Gestores podem atualizar criterios"
ON public.criterios_avaliacao FOR UPDATE TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR (
    public.user_has_screen_permission((auth.uid())::text, '/gestao-adm/criterios-avaliacao')
    AND (
      public.user_grau_num((auth.uid())::text) <= 4
      OR regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
    )
  )
);

CREATE TRIGGER trg_criterios_avaliacao_updated_at
BEFORE UPDATE ON public.criterios_avaliacao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA: avaliacoes_integrantes
-- ============================================================
CREATE TABLE public.avaliacoes_integrantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.avaliacao_periodos(id) ON DELETE CASCADE,
  integrante_id uuid NOT NULL REFERENCES public.integrantes_portal(id) ON DELETE CASCADE,
  criterio_id uuid NOT NULL REFERENCES public.criterios_avaliacao(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sim','nao')),
  observacao text,
  avaliador_id text NOT NULL,
  avaliador_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, integrante_id, criterio_id)
);

CREATE INDEX idx_avaliacoes_periodo ON public.avaliacoes_integrantes(periodo_id);
CREATE INDEX idx_avaliacoes_integrante ON public.avaliacoes_integrantes(integrante_id);

ALTER TABLE public.avaliacoes_integrantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver avaliacoes do escopo"
ON public.avaliacoes_integrantes FOR SELECT TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR public.user_grau_num((auth.uid())::text) <= 4
  OR EXISTS (
    SELECT 1 FROM integrantes_portal ip, profiles p
    WHERE ip.id = integrante_id
      AND p.id = (auth.uid())::text
      AND (
        (public.user_grau_num((auth.uid())::text) = 5 AND ip.regional_id = p.regional_id)
        OR (public.user_grau_num((auth.uid())::text) >= 6 AND ip.divisao_id = p.divisao_id)
      )
  )
);

CREATE POLICY "Avaliadores podem inserir avaliacoes no escopo (periodo aberto)"
ON public.avaliacoes_integrantes FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_screen_permission((auth.uid())::text, '/avaliacao-integrantes')
  AND EXISTS (
    SELECT 1 FROM avaliacao_periodos ap
    WHERE ap.id = periodo_id AND ap.status = 'aberto'
  )
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR public.user_grau_num((auth.uid())::text) <= 4
    OR EXISTS (
      SELECT 1 FROM integrantes_portal ip, profiles p
      WHERE ip.id = integrante_id
        AND p.id = (auth.uid())::text
        AND (
          (public.user_grau_num((auth.uid())::text) = 5 AND ip.regional_id = p.regional_id)
          OR (public.user_grau_num((auth.uid())::text) >= 6 AND ip.divisao_id = p.divisao_id)
        )
    )
  )
);

CREATE POLICY "Avaliadores podem atualizar avaliacoes no escopo (periodo aberto)"
ON public.avaliacoes_integrantes FOR UPDATE TO authenticated
USING (
  public.user_has_screen_permission((auth.uid())::text, '/avaliacao-integrantes')
  AND EXISTS (
    SELECT 1 FROM avaliacao_periodos ap
    WHERE ap.id = periodo_id AND ap.status = 'aberto'
  )
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR public.user_grau_num((auth.uid())::text) <= 4
    OR EXISTS (
      SELECT 1 FROM integrantes_portal ip, profiles p
      WHERE ip.id = integrante_id
        AND p.id = (auth.uid())::text
        AND (
          (public.user_grau_num((auth.uid())::text) = 5 AND ip.regional_id = p.regional_id)
          OR (public.user_grau_num((auth.uid())::text) >= 6 AND ip.divisao_id = p.divisao_id)
        )
    )
  )
);

CREATE TRIGGER trg_avaliacoes_integrantes_updated_at
BEFORE UPDATE ON public.avaliacoes_integrantes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: bloqueia INSERT/UPDATE quando periodo encerrado
CREATE OR REPLACE FUNCTION public.bloquear_avaliacao_periodo_encerrado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM avaliacao_periodos WHERE id = NEW.periodo_id AND status = 'encerrado') THEN
    RAISE EXCEPTION 'Período de avaliação está encerrado. Não é possível modificar avaliações.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloquear_avaliacao_periodo_encerrado
BEFORE INSERT OR UPDATE ON public.avaliacoes_integrantes
FOR EACH ROW EXECUTE FUNCTION public.bloquear_avaliacao_periodo_encerrado();

-- ============================================================
-- SYSTEM SCREENS + permissões iniciais
-- ============================================================
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo) VALUES
('Avaliação de Integrantes', 'Avalia integrantes com base em critérios da regional', '/avaliacao-integrantes', 'ClipboardCheck', 95, true),
('Critérios de Avaliação', 'Gerenciar critérios de avaliação da regional', '/gestao-adm/criterios-avaliacao', 'ListChecks', 96, true),
('Períodos de Avaliação', 'Gerenciar períodos de avaliação semestral', '/gestao-adm/periodos-avaliacao', 'CalendarRange', 97, true)
ON CONFLICT (rota) DO NOTHING;

-- Permissões iniciais
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'),('comando'),('diretor_regional'),('adm_regional'),('diretor_divisao')) AS r(role)
WHERE s.rota = '/avaliacao-integrantes'
ON CONFLICT DO NOTHING;

INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'),('comando'),('diretor_regional'),('adm_regional')) AS r(role)
WHERE s.rota IN ('/gestao-adm/criterios-avaliacao','/gestao-adm/periodos-avaliacao')
ON CONFLICT DO NOTHING;
