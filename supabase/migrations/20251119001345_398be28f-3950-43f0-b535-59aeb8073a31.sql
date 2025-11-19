-- MÓDULO DE FORMULÁRIOS - ESTRUTURA COMPLETA COM AJUSTES DA FASE 2

-- ============================================================================
-- 1. TABELA: formularios_catalogo
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.formularios_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Identificação
  titulo TEXT NOT NULL,
  descricao TEXT,
  
  -- Tipo de formulário
  tipo TEXT NOT NULL CHECK (tipo IN ('builder', 'link_interno', 'url_externa')),
  
  -- Links (condicionais ao tipo)
  link_interno TEXT,
  url_externa TEXT,
  
  -- Escopo
  regional_id UUID NOT NULL REFERENCES public.regionais(id) ON DELETE CASCADE,
  
  -- Periodicidade
  periodicidade TEXT NOT NULL DEFAULT 'semanal' CHECK (periodicidade IN ('diaria', 'semanal', 'mensal')),
  dias_semana INTEGER[],
  limite_respostas TEXT NOT NULL DEFAULT 'multipla' CHECK (limite_respostas IN ('unica', 'multipla')),
  
  -- Controle
  ativo BOOLEAN DEFAULT true,
  roles_permitidas TEXT[]
);

-- Índices para performance
CREATE INDEX idx_formularios_regional ON public.formularios_catalogo(regional_id);
CREATE INDEX idx_formularios_ativo ON public.formularios_catalogo(ativo);
CREATE INDEX idx_formularios_tipo ON public.formularios_catalogo(tipo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_formularios_catalogo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formularios_catalogo_updated_at
  BEFORE UPDATE ON public.formularios_catalogo
  FOR EACH ROW
  EXECUTE FUNCTION update_formularios_catalogo_updated_at();

-- RLS Policies
ALTER TABLE public.formularios_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar formularios_catalogo"
  ON public.formularios_catalogo
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuarios podem ver formularios ativos da sua regional"
  ON public.formularios_catalogo
  FOR SELECT
  USING (
    ativo = true 
    AND regional_id IN (
      SELECT p.regional_id 
      FROM profiles p 
      WHERE p.id = (auth.uid())::text
    )
  );

-- ============================================================================
-- 2. TABELA: relatorios_semanais_divisao (JÁ COM estatisticas_divisao_json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.relatorios_semanais_divisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Relacionamento com catálogo
  formulario_id UUID REFERENCES public.formularios_catalogo(id) ON DELETE CASCADE,
  
  -- Responsável
  profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  integrante_portal_id UUID,
  responsavel_nome_colete TEXT NOT NULL,
  responsavel_cargo_nome TEXT,
  responsavel_divisao_texto TEXT NOT NULL,
  responsavel_regional_texto TEXT NOT NULL,
  responsavel_comando_texto TEXT NOT NULL,
  
  -- Divisão alvo do relatório
  divisao_relatorio_id UUID REFERENCES public.divisoes(id),
  divisao_relatorio_texto TEXT NOT NULL,
  regional_relatorio_id UUID REFERENCES public.regionais(id),
  regional_relatorio_texto TEXT NOT NULL,
  
  -- Período
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  
  -- Conteúdo (JSONB) - NOTA: usando estatisticas_divisao_json desde o início
  entradas_json JSONB DEFAULT '[]'::jsonb,
  saidas_json JSONB DEFAULT '[]'::jsonb,
  inadimplencias_json JSONB DEFAULT '[]'::jsonb,
  conflitos_json JSONB DEFAULT '[]'::jsonb,
  acoes_sociais_json JSONB DEFAULT '[]'::jsonb,
  estatisticas_divisao_json JSONB DEFAULT '{}'::jsonb
);

-- Índices
CREATE INDEX idx_relatorios_profile ON public.relatorios_semanais_divisao(profile_id);
CREATE INDEX idx_relatorios_divisao ON public.relatorios_semanais_divisao(divisao_relatorio_id);
CREATE INDEX idx_relatorios_periodo ON public.relatorios_semanais_divisao(semana_inicio, semana_fim);

-- T3: Índice único para 1 relatório por semana por responsável e formulário
CREATE UNIQUE INDEX uniq_relatorio_semana_por_responsavel
  ON public.relatorios_semanais_divisao(formulario_id, profile_id, semana_inicio, semana_fim);

-- Trigger para updated_at
CREATE TRIGGER relatorios_semanais_updated_at
  BEFORE UPDATE ON public.relatorios_semanais_divisao
  FOR EACH ROW
  EXECUTE FUNCTION update_formularios_catalogo_updated_at();

-- RLS Policies
ALTER TABLE public.relatorios_semanais_divisao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos relatorios"
  ON public.relatorios_semanais_divisao
  FOR SELECT
  USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuarios podem ver relatorios da sua regional"
  ON public.relatorios_semanais_divisao
  FOR SELECT
  USING (
    regional_relatorio_id IN (
      SELECT p.regional_id 
      FROM profiles p 
      WHERE p.id = (auth.uid())::text
    )
  );

-- T2: Policy de INSERT com validação de regional_relatorio_id
CREATE POLICY "Usuarios podem criar relatorios na propria regional"
  ON public.relatorios_semanais_divisao
  FOR INSERT
  WITH CHECK (
    profile_id = (auth.uid())::text
    AND regional_relatorio_id IN (
      SELECT p.regional_id 
      FROM public.profiles p 
      WHERE p.id = (auth.uid())::text
    )
  );

-- Comentários para documentação
COMMENT ON COLUMN public.relatorios_semanais_divisao.estatisticas_divisao_json IS 'Estatísticas da divisão: caveiras, batedores, veículos, estágio, etc.';
COMMENT ON INDEX uniq_relatorio_semana_por_responsavel IS 'Garante apenas 1 relatório por responsável, por formulário, por semana';

-- ============================================================================
-- 3. REGISTRAR TELAS NO SISTEMA DE PERMISSÕES
-- ============================================================================
INSERT INTO public.system_screens (nome, rota, descricao, icone, ativo, ordem)
VALUES 
  ('Administração de Formulários', '/admin/formularios', 'Gerenciar formulários do portal', '📋', true, 50),
  ('Formulários', '/formularios', 'Acessar formulários disponíveis', '📝', true, 60)
ON CONFLICT (rota) DO NOTHING;

-- Permissões: apenas admins podem acessar /admin/formularios
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'admin'::app_role
FROM public.system_screens
WHERE rota = '/admin/formularios'
ON CONFLICT DO NOTHING;

-- Permissões: usuários autenticados podem acessar /formularios
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, unnest(ARRAY['admin'::app_role, 'moderator'::app_role, 'diretor_regional'::app_role, 'diretor_divisao'::app_role, 'regional'::app_role, 'user'::app_role])
FROM public.system_screens
WHERE rota = '/formularios'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CRIAR FORMULÁRIO ESPECIAL "RELATÓRIO SEMANAL DA DIVISÃO"
-- ============================================================================
INSERT INTO public.formularios_catalogo (
  titulo,
  descricao,
  tipo,
  link_interno,
  regional_id,
  periodicidade,
  dias_semana,
  limite_respostas,
  ativo
)
SELECT 
  'Relatório Semanal da Divisão',
  'Relatório semanal de atividades, entradas, saídas e inadimplência da divisão',
  'link_interno',
  '/formularios/relatorio-semanal-divisao',
  r.id,
  'semanal',
  ARRAY[4,5,6], -- quinta, sexta, sábado
  'multipla',
  true
FROM public.regionais r
WHERE UPPER(UNACCENT(r.nome)) LIKE '%VALE DO PARAIBA I%'
  OR UPPER(UNACCENT(r.nome)) LIKE '%VP1%'
ON CONFLICT DO NOTHING;