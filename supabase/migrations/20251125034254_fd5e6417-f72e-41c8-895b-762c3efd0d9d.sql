-- ============================================================
-- Migration: Ajustes para tratamento admin de exclusões
-- Data: 2025-11-25
-- ============================================================

-- 1.1) Adicionar campo status_registro em acoes_sociais_registros
-- Permite marcar registros como 'ativo' ou 'excluido'
ALTER TABLE public.acoes_sociais_registros
ADD COLUMN IF NOT EXISTS status_registro text DEFAULT 'ativo';

COMMENT ON COLUMN public.acoes_sociais_registros.status_registro IS 
'Status do registro: ativo | excluido';

-- 1.2) Adicionar campo observacao_admin em acoes_sociais_solicitacoes_exclusao
-- Armazena justificativa da decisão administrativa
ALTER TABLE public.acoes_sociais_solicitacoes_exclusao
ADD COLUMN IF NOT EXISTS observacao_admin text;

COMMENT ON COLUMN public.acoes_sociais_solicitacoes_exclusao.observacao_admin IS 
'Justificativa do admin ao aprovar/reprovar solicitação de exclusão';