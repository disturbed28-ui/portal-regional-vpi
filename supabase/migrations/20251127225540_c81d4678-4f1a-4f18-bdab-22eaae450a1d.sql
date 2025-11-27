-- Adicionar campos de controle de semana operacional (Domingo → Sábado)
ALTER TABLE relatorios_semanais_divisao 
ADD COLUMN IF NOT EXISTS ano_referencia INTEGER,
ADD COLUMN IF NOT EXISTS mes_referencia INTEGER,
ADD COLUMN IF NOT EXISTS semana_no_mes INTEGER;

-- Comentários para documentação
COMMENT ON COLUMN relatorios_semanais_divisao.ano_referencia IS 'Ano do sábado (semana_fim)';
COMMENT ON COLUMN relatorios_semanais_divisao.mes_referencia IS 'Mês do sábado (1-12)';
COMMENT ON COLUMN relatorios_semanais_divisao.semana_no_mes IS 'Número da semana dentro do mês (1-5)';

-- Migração retroativa: calcular campos baseado em semana_fim (sábado)
UPDATE relatorios_semanais_divisao
SET 
  ano_referencia = EXTRACT(YEAR FROM semana_fim)::INTEGER,
  mes_referencia = EXTRACT(MONTH FROM semana_fim)::INTEGER,
  semana_no_mes = (
    -- Calcular posição do sábado entre os sábados do mês
    1 + FLOOR(
      (EXTRACT(DAY FROM semana_fim)::INTEGER - 1 - 
       (6 - EXTRACT(DOW FROM DATE_TRUNC('month', semana_fim))::INTEGER + 7) % 7
      ) / 7.0
    )
  )::INTEGER
WHERE ano_referencia IS NULL;