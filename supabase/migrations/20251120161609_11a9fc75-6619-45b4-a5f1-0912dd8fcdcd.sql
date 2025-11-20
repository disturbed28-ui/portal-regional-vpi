-- ============================================================================
-- FASE 4: Ajustar unicidade de relatório semanal para ser por divisão
-- ============================================================================

-- 1. Remover índice antigo baseado em profile_id
DROP INDEX IF EXISTS public.uniq_relatorio_semana_por_responsavel;

-- 2. Criar novo índice baseado em divisao_relatorio_id
CREATE UNIQUE INDEX uniq_relatorio_semana_por_divisao
  ON public.relatorios_semanais_divisao(
    formulario_id, 
    divisao_relatorio_id, 
    semana_inicio, 
    semana_fim
  );

-- 3. Atualizar comentário para documentação
COMMENT ON INDEX public.uniq_relatorio_semana_por_divisao 
  IS 'Garante apenas 1 relatório por divisão, por formulário, por semana (independente do responsável)';