-- Adicionar campo booleano na tabela acoes_sociais_registros
ALTER TABLE public.acoes_sociais_registros 
ADD COLUMN IF NOT EXISTS foi_reportada_em_relatorio BOOLEAN DEFAULT false;

-- Índice para otimizar consultas de ações não reportadas por divisão
CREATE INDEX IF NOT EXISTS idx_acoes_sociais_foi_reportada 
ON public.acoes_sociais_registros(divisao_relatorio_id, foi_reportada_em_relatorio);

-- Comentário para documentação
COMMENT ON COLUMN public.acoes_sociais_registros.foi_reportada_em_relatorio 
IS 'Indica se esta ação social já foi incluída em algum relatório semanal de divisão';