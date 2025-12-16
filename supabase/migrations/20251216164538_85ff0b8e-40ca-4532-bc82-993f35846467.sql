-- View para consolidar movimentações de integrantes (mudanças de divisão, regional, status)
CREATE OR REPLACE VIEW public.vw_movimentacoes_integrantes AS
SELECT 
  ac.id,
  ac.integrante_id,
  ac.registro_id,
  ac.nome_colete,
  ac.campo_alterado,
  ac.valor_anterior,
  ac.valor_novo,
  ac.created_at as data_movimentacao,
  ch.data_carga,
  ch.id as carga_id,
  CASE 
    WHEN ac.campo_alterado = 'divisao_texto' THEN 'MUDANCA_DIVISAO'
    WHEN ac.campo_alterado = 'regional_texto' THEN 'MUDANCA_REGIONAL'
    WHEN ac.campo_alterado = 'ativo' AND ac.valor_novo = 'false' THEN 'INATIVACAO'
    WHEN ac.campo_alterado = 'ativo' AND ac.valor_novo = 'true' THEN 'REATIVACAO'
    ELSE 'OUTRO'
  END as tipo_movimentacao
FROM public.atualizacoes_carga ac
LEFT JOIN public.cargas_historico ch ON ch.id = ac.carga_historico_id
WHERE ac.campo_alterado IN ('divisao_texto', 'regional_texto', 'ativo')
ORDER BY ac.created_at DESC;

-- Comentário na view
COMMENT ON VIEW public.vw_movimentacoes_integrantes IS 'Consolidação de movimentações de integrantes: mudanças de divisão, regional e status ativo/inativo';