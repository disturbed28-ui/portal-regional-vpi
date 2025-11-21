-- ============================================================================
-- TABELA: acoes_sociais_tipos
-- ============================================================================
CREATE TABLE public.acoes_sociais_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  ordem integer,
  created_at timestamptz DEFAULT now()
);

-- RLS: Ativar
ALTER TABLE public.acoes_sociais_tipos ENABLE ROW LEVEL SECURITY;

-- RLS: Todos podem ver tipos ativos
CREATE POLICY "Todos podem ver tipos de ação social"
  ON public.acoes_sociais_tipos
  FOR SELECT
  USING (true);

-- RLS: Apenas admins podem gerenciar tipos
CREATE POLICY "Apenas admins podem gerenciar tipos de ação social"
  ON public.acoes_sociais_tipos
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Popular com os 27 tipos de ação
INSERT INTO public.acoes_sociais_tipos (nome, ordem) VALUES
  ('Ação de ajuda/proteção de animais', 1),
  ('Ação de impacto ambiental', 2),
  ('Ação em conjunto com outros Moto Clubes', 3),
  ('Ação em cooperação com Médicos do Mundo', 4),
  ('Ação emergencial', 5),
  ('Ação Pet, resgate de animais, apoio à adoção, doações (ração, higiene para abrigos)', 6),
  ('Ação Social Dia das Crianças', 7),
  ('Apoio jurídico', 8),
  ('Ação Saúde Mental', 9),
  ('Arrecadação / Captação de recursos', 10),
  ('Atividades recreativas, palestras, oficinas', 11),
  ('Cadeira de rodas, muleta, andador', 12),
  ('Cestas básicas, mantimentos, alimentos, leite', 13),
  ('Contenção e apoio operacional', 14),
  ('Distribuição de marmitex, lanches, café, sopa', 15),
  ('Doação de cabelos', 16),
  ('Doação de móveis e eletrodomésticos', 17),
  ('Doação de sangue', 18),
  ('Material escolar', 19),
  ('McDia Feliz', 20),
  ('Mega campanha de doação de sangue', 21),
  ('Natal', 22),
  ('Páscoa', 23),
  ('Produtos de higiene pessoal / limpeza', 24),
  ('Reconstrução / Reforma de habitação', 25),
  ('Roupas, agasalhos, calçados e cobertores', 26),
  ('Visita de humanização', 27);

-- ============================================================================
-- TABELA: acoes_sociais_registros
-- ============================================================================
CREATE TABLE public.acoes_sociais_registros (
  -- IDs principais
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Vínculos
  formulario_id uuid REFERENCES formularios_catalogo(id),
  profile_id text NOT NULL,
  integrante_portal_id uuid REFERENCES integrantes_portal(id),
  
  -- Snapshot do responsável (quem enviou)
  responsavel_nome_colete text NOT NULL,
  responsavel_cargo_nome text,
  responsavel_divisao_texto text NOT NULL,
  responsavel_regional_texto text NOT NULL,
  responsavel_comando_texto text NOT NULL,
  
  -- Divisão/Regional da ação (pode ser diferente da divisão do responsável)
  regional_relatorio_id uuid REFERENCES regionais(id),
  regional_relatorio_texto text NOT NULL,
  divisao_relatorio_id uuid REFERENCES divisoes(id),
  divisao_relatorio_texto text NOT NULL,
  
  -- Campos do formulário
  data_acao date NOT NULL,
  escopo_acao text NOT NULL CHECK (escopo_acao IN ('interna', 'externa')),
  tipo_acao_id uuid REFERENCES acoes_sociais_tipos(id),
  tipo_acao_nome_snapshot text NOT NULL,
  descricao_acao text
);

-- Trigger para updated_at
CREATE TRIGGER set_updated_at_acoes_sociais
  BEFORE UPDATE ON public.acoes_sociais_registros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Ativar
ALTER TABLE public.acoes_sociais_registros ENABLE ROW LEVEL SECURITY;

-- RLS: Admins veem tudo
CREATE POLICY "Admins podem ver todas ações sociais"
  ON public.acoes_sociais_registros
  FOR SELECT
  USING (has_role((auth.uid())::text, 'admin'::app_role));

-- RLS: Usuários veem registros da sua regional
CREATE POLICY "Usuarios podem ver ações sociais da sua regional"
  ON public.acoes_sociais_registros
  FOR SELECT
  USING (
    regional_relatorio_id IN (
      SELECT p.regional_id
      FROM profiles p
      WHERE p.id = (auth.uid())::text
    )
  );

-- RLS: Usuários podem inserir se profile_id = auth.uid()
CREATE POLICY "Usuarios podem inserir suas proprias ações sociais"
  ON public.acoes_sociais_registros
  FOR INSERT
  WITH CHECK (profile_id = (auth.uid())::text);

-- RLS: Apenas admins podem atualizar/deletar
CREATE POLICY "Apenas admins podem gerenciar ações sociais"
  ON public.acoes_sociais_registros
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Índices
CREATE INDEX idx_acoes_sociais_profile ON acoes_sociais_registros(profile_id);
CREATE INDEX idx_acoes_sociais_divisao ON acoes_sociais_registros(divisao_relatorio_id);
CREATE INDEX idx_acoes_sociais_data ON acoes_sociais_registros(data_acao DESC);