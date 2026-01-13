-- Adicionar campos de escalação na tabela aprovacoes_estagio
-- Para equiparar ao comportamento de aprovacoes_treinamento

ALTER TABLE aprovacoes_estagio
ADD COLUMN IF NOT EXISTS aprovado_por_escalacao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS aprovador_escalacao_id text,
ADD COLUMN IF NOT EXISTS aprovador_escalacao_nome text,
ADD COLUMN IF NOT EXISTS justificativa_escalacao text;