-- Criar tabela estagios_historico (análoga a treinamentos_historico)
CREATE TABLE estagios_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id uuid NOT NULL REFERENCES integrantes_portal(id),
  cargo_estagio_id uuid REFERENCES cargos(id),
  grau_estagio text NOT NULL,
  tipo_encerramento text NOT NULL,
  observacoes text,
  encerrado_por uuid,
  encerrado_por_nome_colete text,
  encerrado_por_cargo text,
  encerrado_por_divisao text,
  data_inicio date,
  data_encerramento timestamp with time zone DEFAULT now() NOT NULL,
  solicitacao_id uuid REFERENCES solicitacoes_estagio(id),
  divisao_id uuid REFERENCES divisoes(id),
  regional_id uuid REFERENCES regionais(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE estagios_historico ENABLE ROW LEVEL SECURITY;

-- Política para leitura (usuários autenticados podem ver baseado no nível de acesso)
CREATE POLICY "Usuários autenticados podem ler histórico de estágios"
  ON estagios_historico FOR SELECT TO authenticated USING (true);

-- Política para inserção (usuários autenticados podem inserir)
CREATE POLICY "Usuários autenticados podem inserir histórico de estágios"
  ON estagios_historico FOR INSERT TO authenticated WITH CHECK (true);

-- Adicionar comentário na tabela
COMMENT ON TABLE estagios_historico IS 'Histórico de estágios encerrados';