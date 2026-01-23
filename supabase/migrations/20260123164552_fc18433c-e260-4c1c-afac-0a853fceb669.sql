-- Corrigir solicitações de estágio com todas aprovações concluídas
-- mas status ainda "Em Aprovacao"
UPDATE solicitacoes_estagio se
SET 
  status = 'Em Estagio',
  data_aprovacao = NOW()
WHERE 
  se.status = 'Em Aprovacao'
  AND NOT EXISTS (
    SELECT 1 
    FROM aprovacoes_estagio ae 
    WHERE ae.solicitacao_id = se.id 
    AND ae.status != 'aprovado'
  )
  AND EXISTS (
    SELECT 1 
    FROM aprovacoes_estagio ae 
    WHERE ae.solicitacao_id = se.id
  );