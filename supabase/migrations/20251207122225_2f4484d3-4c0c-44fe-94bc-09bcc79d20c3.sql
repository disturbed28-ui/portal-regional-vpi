-- =====================================================
-- MIGRAÇÃO: Tratamento de Eventos Cancelados/Removidos da Agenda
-- =====================================================

-- 1. Adicionar coluna status na tabela eventos_agenda
ALTER TABLE eventos_agenda 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Adicionar constraint para validar valores
ALTER TABLE eventos_agenda
ADD CONSTRAINT eventos_agenda_status_check 
CHECK (status IN ('active', 'cancelled', 'removed'));

-- Índice para otimização de consultas de delta
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_status 
ON eventos_agenda(status);

COMMENT ON COLUMN eventos_agenda.status IS 
'Status do evento: active (ativo), cancelled (cancelado no Google), removed (deletado do Google)';

-- 2. Criar tabela de eventos arquivados (histórico)
CREATE TABLE eventos_agenda_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_original_id uuid NOT NULL,
  evento_google_id text NOT NULL,
  titulo text NOT NULL,
  data_evento timestamptz NOT NULL,
  regional_id uuid,
  divisao_id uuid,
  tipo_evento text,
  tipo_evento_peso text,
  status_original text NOT NULL,
  evento_created_at timestamptz,
  motivo_exclusao text NOT NULL,
  excluido_em timestamptz DEFAULT now(),
  excluido_por text NOT NULL
);

-- 3. Criar tabela de presenças arquivadas (histórico)
CREATE TABLE presencas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_historico_id uuid NOT NULL REFERENCES eventos_agenda_historico(id) ON DELETE CASCADE,
  presenca_original_id uuid NOT NULL,
  integrante_id uuid,
  profile_id text,
  status text NOT NULL,
  justificativa_ausencia text,
  justificativa_tipo text,
  confirmado_em timestamptz,
  confirmado_por text,
  visitante_nome text,
  visitante_tipo text
);

-- Índices para as tabelas de histórico
CREATE INDEX idx_eventos_historico_evento_original ON eventos_agenda_historico(evento_original_id);
CREATE INDEX idx_eventos_historico_excluido_em ON eventos_agenda_historico(excluido_em);
CREATE INDEX idx_presencas_historico_evento ON presencas_historico(evento_historico_id);

-- 4. Habilitar RLS nas tabelas de histórico
ALTER TABLE eventos_agenda_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas_historico ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para eventos_agenda_historico
CREATE POLICY "Admins podem ver historico eventos"
ON eventos_agenda_historico FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Sistema pode inserir historico eventos"
ON eventos_agenda_historico FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins podem deletar historico eventos"
ON eventos_agenda_historico FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- 6. Políticas RLS para presencas_historico
CREATE POLICY "Admins podem ver historico presencas"
ON presencas_historico FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Sistema pode inserir historico presencas"
ON presencas_historico FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins podem deletar historico presencas"
ON presencas_historico FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));