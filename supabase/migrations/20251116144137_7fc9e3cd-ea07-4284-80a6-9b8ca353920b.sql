-- =====================================================
-- CORREÇÃO: Relatório de Inadimplência - Grau V
-- =====================================================
-- Objetivo: Integrantes Grau V devem aparecer agrupados
-- pela REGIONAL, não pela divisão operacional
-- =====================================================

-- ETAPA 1: Recriar view vw_devedores_ativos com regra Grau V
-- =====================================================
DROP VIEW IF EXISTS vw_devedores_ativos;

CREATE VIEW vw_devedores_ativos AS
SELECT 
  ma.registro_id,
  ma.nome_colete,
  -- REGRA NOVA: Se Grau V, exibir regional_texto; senão, divisao_texto
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END AS divisao_texto,
  COUNT(DISTINCT ma.ref) as meses_devendo,
  COUNT(*) as total_parcelas,
  SUM(ma.valor) as total_devido,
  MAX(ma.data_vencimento) as ultimo_vencimento,
  MAX(ma.data_carga) as ultima_carga
FROM mensalidades_atraso ma
LEFT JOIN integrantes_portal ip ON ip.registro_id = ma.registro_id
WHERE ma.ativo = true AND ma.liquidado = false
GROUP BY 
  ma.registro_id, 
  ma.nome_colete, 
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END;

-- =====================================================
-- ETAPA 2: Recriar view vw_devedores_cronicos com regra Grau V
-- =====================================================
DROP VIEW IF EXISTS vw_devedores_cronicos;

CREATE VIEW vw_devedores_cronicos AS
SELECT 
  ma.registro_id,
  ma.nome_colete,
  -- REGRA NOVA: Se Grau V, exibir regional_texto; senão, divisao_texto
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END AS divisao_texto,
  COUNT(DISTINCT ma.ref) as total_meses_historico,
  SUM(ma.valor) as total_historico_devido,
  MIN(ma.data_vencimento) as primeira_divida,
  MAX(ma.data_vencimento) as ultima_divida
FROM mensalidades_atraso ma
LEFT JOIN integrantes_portal ip ON ip.registro_id = ma.registro_id
GROUP BY 
  ma.registro_id, 
  ma.nome_colete,
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END
HAVING COUNT(DISTINCT ma.ref) >= 3
ORDER BY total_meses_historico DESC;

-- =====================================================
-- ETAPA 3: Corrigir dados existentes em mensalidades_atraso
-- =====================================================
-- Objetivo: Atualizar divisao_texto de integrantes Grau V
-- para que aponte para regional_texto
-- =====================================================

UPDATE mensalidades_atraso ma
SET divisao_texto = ip.regional_texto
FROM integrantes_portal ip
WHERE ma.registro_id = ip.registro_id
  AND ip.grau = 'V'
  AND ip.ativo = true
  AND ma.divisao_texto != ip.regional_texto;

-- Comentário: Esta migration corrige o bug onde integrantes Grau V
-- aparecem em divisões operacionais ao invés de suas regionais.