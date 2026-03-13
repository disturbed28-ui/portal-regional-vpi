
-- Recriar views para excluir integrantes inativos dos indicadores

-- ETAPA 1: vw_devedores_ativos — apenas integrantes ativos
DROP VIEW IF EXISTS vw_devedores_ativos;

CREATE VIEW vw_devedores_ativos AS
SELECT 
  ma.registro_id,
  ma.nome_colete,
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
INNER JOIN integrantes_portal ip ON ip.registro_id = ma.registro_id AND ip.ativo = true
WHERE ma.ativo = true AND ma.liquidado = false
GROUP BY 
  ma.registro_id, 
  ma.nome_colete, 
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END;

-- ETAPA 2: vw_devedores_cronicos — apenas integrantes ativos
DROP VIEW IF EXISTS vw_devedores_cronicos;

CREATE VIEW vw_devedores_cronicos AS
SELECT 
  ma.registro_id,
  ma.nome_colete,
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END AS divisao_texto,
  COUNT(DISTINCT ma.ref) as total_meses_historico,
  SUM(ma.valor) as total_historico_devido,
  MIN(ma.data_vencimento) as primeira_divida,
  MAX(ma.data_vencimento) as ultima_divida
FROM mensalidades_atraso ma
INNER JOIN integrantes_portal ip ON ip.registro_id = ma.registro_id AND ip.ativo = true
GROUP BY 
  ma.registro_id, 
  ma.nome_colete,
  CASE 
    WHEN ip.grau = 'V' THEN ip.regional_texto
    ELSE ma.divisao_texto
  END
HAVING COUNT(DISTINCT ma.ref) >= 3
ORDER BY total_meses_historico DESC;
