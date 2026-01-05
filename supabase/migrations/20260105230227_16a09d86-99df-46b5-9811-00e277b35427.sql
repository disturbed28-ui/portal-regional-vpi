-- Tabela de solicitações de estágio
CREATE TABLE IF NOT EXISTS solicitacoes_estagio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id UUID NOT NULL REFERENCES integrantes_portal(id) ON DELETE CASCADE,
  divisao_id UUID REFERENCES divisoes(id),
  regional_id UUID REFERENCES regionais(id),
  cargo_atual_id UUID REFERENCES cargos(id),
  cargo_estagio_id UUID NOT NULL REFERENCES cargos(id),
  grau_estagio TEXT NOT NULL CHECK (grau_estagio IN ('V', 'VI')),
  solicitante_integrante_id UUID REFERENCES integrantes_portal(id),
  solicitante_nome_colete TEXT NOT NULL,
  solicitante_cargo_id UUID REFERENCES cargos(id),
  solicitante_divisao_id UUID REFERENCES divisoes(id),
  data_hora_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Em Aprovacao',
  observacoes TEXT,
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  data_inicio_estagio DATE,
  tempo_estagio_meses INTEGER DEFAULT 6,
  data_termino_previsto DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_estagio_integrante ON solicitacoes_estagio(integrante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_estagio_status ON solicitacoes_estagio(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_estagio_regional ON solicitacoes_estagio(regional_id);

-- RLS
ALTER TABLE solicitacoes_estagio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar solicitacoes_estagio" ON solicitacoes_estagio
  FOR ALL USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuarios autenticados podem criar solicitacoes_estagio" ON solicitacoes_estagio
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem ver solicitacoes_estagio da sua regional" ON solicitacoes_estagio
  FOR SELECT USING (regional_id IN (
    SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text
  ));

-- Adicionar coluna cargo_estagio_id na integrantes_portal (se não existir)
ALTER TABLE integrantes_portal 
ADD COLUMN IF NOT EXISTS cargo_estagio_id UUID REFERENCES cargos(id);

-- Settings para tempo padrão de estágio por grau
INSERT INTO system_settings (chave, valor, valor_texto, descricao)
VALUES 
  ('tempo_estagio_grau5_padrao', true, '9', 'Tempo padrão de estágio para Grau V (meses)'),
  ('tempo_estagio_grau6_padrao', true, '6', 'Tempo padrão de estágio para Grau VI (meses)')
ON CONFLICT (chave) DO NOTHING;