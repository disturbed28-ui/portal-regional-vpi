-- Adicionar colunas para registrar aprovação por escalação hierárquica
ALTER TABLE aprovacoes_treinamento 
ADD COLUMN IF NOT EXISTS aprovado_por_escalacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS aprovador_escalacao_id TEXT,
ADD COLUMN IF NOT EXISTS aprovador_escalacao_nome TEXT,
ADD COLUMN IF NOT EXISTS justificativa_escalacao TEXT;

COMMENT ON COLUMN aprovacoes_treinamento.aprovado_por_escalacao IS 'true se foi aprovado por superior hierárquico (DR)';
COMMENT ON COLUMN aprovacoes_treinamento.aprovador_escalacao_id IS 'ID do integrante que aprovou por escalação';
COMMENT ON COLUMN aprovacoes_treinamento.aprovador_escalacao_nome IS 'Nome do aprovador por escalação';
COMMENT ON COLUMN aprovacoes_treinamento.justificativa_escalacao IS 'Justificativa do DR para aprovar fora da vez';