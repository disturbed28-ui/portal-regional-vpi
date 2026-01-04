-- Adicionar coluna solicitacao_id em treinamentos_historico para vincular ao registro original
ALTER TABLE treinamentos_historico 
ADD COLUMN solicitacao_id uuid REFERENCES solicitacoes_treinamento(id);

-- Adicionar coluna data_aprovacao em solicitacoes_treinamento
ALTER TABLE solicitacoes_treinamento 
ADD COLUMN data_aprovacao timestamp with time zone;