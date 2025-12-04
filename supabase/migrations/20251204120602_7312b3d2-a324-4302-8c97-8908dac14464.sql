-- Remover duplicatas existentes, mantendo apenas o registro mais recente
-- Isso vai manter o registro com created_at mais recente para cada combinação única
DELETE FROM acoes_sociais_registros 
WHERE id NOT IN (
  SELECT DISTINCT ON (data_acao, responsavel_nome_colete, divisao_relatorio_texto)
    id
  FROM acoes_sociais_registros
  ORDER BY data_acao, responsavel_nome_colete, divisao_relatorio_texto, 
           created_at DESC
);