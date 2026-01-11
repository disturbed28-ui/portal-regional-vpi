-- ===================================================================
-- Migração: Suporte para Promoção Grau IV e Cadastro Manual
-- ===================================================================

-- 1. Nova ação de resolução para promoção a Grau IV
INSERT INTO acoes_resolucao_delta (
  tipo_delta_codigo, 
  codigo_acao, 
  label, 
  descricao, 
  ordem,
  ativo
)
VALUES (
  'SUMIU_ATIVOS', 
  'promovido_grau4', 
  '⬆️ Promovido para Grau IV (Comando)', 
  'Integrante foi promovido para cargo de Grau IV e permanece ativo com novo cargo/regional', 
  6,
  true
)
ON CONFLICT DO NOTHING;

-- 2. Adicionar novos campos na tabela pendencias_ajuste_roles
-- Tipo de pendência: 'alteracao_cargo', 'promocao_grau4', 'cadastro_manual'
ALTER TABLE pendencias_ajuste_roles 
ADD COLUMN IF NOT EXISTS tipo_pendencia TEXT DEFAULT 'alteracao_cargo';

-- Profile ID para casos de cadastro manual vinculado a profile (TEXT, não UUID, pois profiles.id é TEXT)
ALTER TABLE pendencias_ajuste_roles 
ADD COLUMN IF NOT EXISTS profile_id TEXT;

-- Dados adicionais (JSON) para armazenar contexto extra
ALTER TABLE pendencias_ajuste_roles 
ADD COLUMN IF NOT EXISTS dados_adicionais JSONB;

-- 3. Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_pendencias_tipo ON pendencias_ajuste_roles(tipo_pendencia);
CREATE INDEX IF NOT EXISTS idx_pendencias_profile ON pendencias_ajuste_roles(profile_id) WHERE profile_id IS NOT NULL;

-- 4. Comentários para documentação
COMMENT ON COLUMN pendencias_ajuste_roles.tipo_pendencia IS 'Tipo: alteracao_cargo, promocao_grau4, cadastro_manual';
COMMENT ON COLUMN pendencias_ajuste_roles.profile_id IS 'Profile ID relacionado (para cadastros manuais)';
COMMENT ON COLUMN pendencias_ajuste_roles.dados_adicionais IS 'Dados extras do contexto da pendência';