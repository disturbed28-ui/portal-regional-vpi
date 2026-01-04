-- Adicionar colunas na tabela solicitacoes_treinamento
ALTER TABLE solicitacoes_treinamento 
ADD COLUMN IF NOT EXISTS data_inicio_treinamento DATE,
ADD COLUMN IF NOT EXISTS tempo_treinamento_meses INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS data_termino_previsto DATE;

-- Inserir configuração padrão para tempo de treinamento (valor inicial: 3 meses)
INSERT INTO system_settings (chave, valor, valor_texto, descricao)
VALUES ('tempo_treinamento_padrao', true, '3', 'Tempo padrão de treinamento em meses (última seleção)')
ON CONFLICT (chave) DO NOTHING;