-- Adicionar campos de controle à tabela mensalidades_atraso
ALTER TABLE mensalidades_atraso
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS liquidado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_liquidacao TIMESTAMP WITH TIME ZONE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_mensalidades_ativo ON mensalidades_atraso(ativo);
CREATE INDEX IF NOT EXISTS idx_mensalidades_registro_ref ON mensalidades_atraso(registro_id, ref);
CREATE INDEX IF NOT EXISTS idx_mensalidades_data_carga ON mensalidades_atraso(data_carga);
CREATE INDEX IF NOT EXISTS idx_mensalidades_liquidado ON mensalidades_atraso(liquidado);

-- View para devedores ativos únicos
CREATE OR REPLACE VIEW vw_devedores_ativos AS
SELECT 
  registro_id,
  nome_colete,
  divisao_texto,
  COUNT(DISTINCT ref) as meses_devendo,
  COUNT(*) as total_parcelas,
  SUM(valor) as total_devido,
  MAX(data_vencimento) as ultimo_vencimento,
  MAX(data_carga) as ultima_carga
FROM mensalidades_atraso
WHERE ativo = true AND liquidado = false
GROUP BY registro_id, nome_colete, divisao_texto;

-- View para devedores crônicos (deveu 3+ meses diferentes)
CREATE OR REPLACE VIEW vw_devedores_cronicos AS
SELECT 
  registro_id,
  nome_colete,
  divisao_texto,
  COUNT(DISTINCT ref) as total_meses_historico,
  SUM(valor) as total_historico_devido,
  MIN(data_vencimento) as primeira_divida,
  MAX(data_vencimento) as ultima_divida
FROM mensalidades_atraso
GROUP BY registro_id, nome_colete, divisao_texto
HAVING COUNT(DISTINCT ref) >= 3
ORDER BY total_meses_historico DESC;