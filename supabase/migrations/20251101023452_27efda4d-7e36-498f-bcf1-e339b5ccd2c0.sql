-- 1. Adicionar coluna status na tabela presencas
ALTER TABLE presencas 
ADD COLUMN status text NOT NULL DEFAULT 'ausente';

-- 2. Atualizar registros existentes para 'presente' (pois já estão confirmados)
UPDATE presencas SET status = 'presente';

-- 3. Adicionar constraint de validação
ALTER TABLE presencas 
ADD CONSTRAINT presencas_status_check 
CHECK (status IN ('presente', 'ausente', 'visitante'));

-- 4. Criar índice para melhor performance
CREATE INDEX idx_presencas_status ON presencas(status);