-- 1. Adicionar SLA por cargo (preparação para configuração futura)
ALTER TABLE public.cargos 
ADD COLUMN IF NOT EXISTS sla_treinamento_meses INTEGER DEFAULT 3;

-- 2. Adicionar campos de auditoria no histórico de treinamentos
ALTER TABLE public.treinamentos_historico
ADD COLUMN IF NOT EXISTS encerrado_por_cargo TEXT,
ADD COLUMN IF NOT EXISTS encerrado_por_divisao TEXT;