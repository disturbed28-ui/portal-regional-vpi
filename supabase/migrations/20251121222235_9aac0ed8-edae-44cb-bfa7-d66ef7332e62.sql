-- =====================================================
-- FASE 1: AJUSTES NO BANCO DE DADOS - AÇÕES SOCIAIS
-- =====================================================

-- 1.1. Adicionar campos na tabela acoes_sociais_registros
ALTER TABLE acoes_sociais_registros
ADD COLUMN IF NOT EXISTS google_form_status text DEFAULT 'nao_enviado',
ADD COLUMN IF NOT EXISTS google_form_enviado_em timestamptz,
ADD COLUMN IF NOT EXISTS google_form_enviado_por text;

CREATE INDEX IF NOT EXISTS idx_acoes_google_status 
ON acoes_sociais_registros(google_form_status);

-- 1.2. Criar tabela acoes_sociais_config_regional
CREATE TABLE IF NOT EXISTS acoes_sociais_config_regional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_texto text NOT NULL,
  email_formulario text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice único: apenas 1 configuração ativa por regional
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_regional_unico 
ON acoes_sociais_config_regional (regional_texto) 
WHERE ativo = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_acoes_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_acoes_config_updated_at
BEFORE UPDATE ON acoes_sociais_config_regional
FOR EACH ROW
EXECUTE FUNCTION update_acoes_config_updated_at();

-- Registro inicial
INSERT INTO acoes_sociais_config_regional (regional_texto, email_formulario)
VALUES ('Regional Vale do Paraiba 1 - SP', 'social.regional.vp1@gmail.com')
ON CONFLICT DO NOTHING;

-- RLS Policies para acoes_sociais_config_regional
ALTER TABLE acoes_sociais_config_regional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configurações"
ON acoes_sociais_config_regional
FOR SELECT
USING (true);

CREATE POLICY "Apenas admins podem gerenciar configurações"
ON acoes_sociais_config_regional
FOR ALL
USING (has_role((auth.uid())::text, 'admin'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- 1.3. Criar tabela acoes_sociais_solicitacoes_exclusao
CREATE TABLE IF NOT EXISTS acoes_sociais_solicitacoes_exclusao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES acoes_sociais_registros(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  justificativa text NOT NULL,
  status text DEFAULT 'pendente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processado_por text,
  processado_em timestamptz
);

-- Única solicitação pendente por registro
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusao_pendente_unico
ON acoes_sociais_solicitacoes_exclusao (registro_id)
WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_exclusao_profile 
ON acoes_sociais_solicitacoes_exclusao(profile_id);

CREATE INDEX IF NOT EXISTS idx_exclusao_status 
ON acoes_sociais_solicitacoes_exclusao(status);

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_solicitacoes_exclusao_updated_at
BEFORE UPDATE ON acoes_sociais_solicitacoes_exclusao
FOR EACH ROW
EXECUTE FUNCTION update_acoes_config_updated_at();

-- RLS Policies para acoes_sociais_solicitacoes_exclusao
ALTER TABLE acoes_sociais_solicitacoes_exclusao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias solicitações"
ON acoes_sociais_solicitacoes_exclusao
FOR SELECT
USING (profile_id = (auth.uid())::text);

CREATE POLICY "Admins podem ver todas solicitações"
ON acoes_sociais_solicitacoes_exclusao
FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuários podem criar solicitações para seus registros"
ON acoes_sociais_solicitacoes_exclusao
FOR INSERT
WITH CHECK (
  profile_id = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM acoes_sociais_registros
    WHERE id = registro_id AND profile_id = (auth.uid())::text
  )
);

CREATE POLICY "Apenas admins podem atualizar solicitações"
ON acoes_sociais_solicitacoes_exclusao
FOR UPDATE
USING (has_role((auth.uid())::text, 'admin'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Apenas admins podem deletar solicitações"
ON acoes_sociais_solicitacoes_exclusao
FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- =====================================================
-- FASE 2: REGISTRO NO SISTEMA SPRINGS
-- =====================================================

-- 2.1. Registrar tela em system_screens
INSERT INTO system_screens (nome, descricao, rota, icone, ordem, ativo)
VALUES (
  'Ações Sociais',
  'Consulta, detalhes e gerenciamento de ações sociais registradas',
  '/acoes-sociais',
  'Heart',
  10,
  true
)
ON CONFLICT (rota) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    ordem = EXCLUDED.ordem,
    ativo = EXCLUDED.ativo;

-- 2.2. Registrar permissões em screen_permissions
WITH screen AS (
  SELECT id FROM system_screens WHERE rota = '/acoes-sociais'
)
INSERT INTO screen_permissions (screen_id, role)
SELECT screen.id, unnest(ARRAY['regional', 'diretor_regional', 'diretor_divisao', 'moderator']::app_role[])
FROM screen
ON CONFLICT (screen_id, role) DO NOTHING;