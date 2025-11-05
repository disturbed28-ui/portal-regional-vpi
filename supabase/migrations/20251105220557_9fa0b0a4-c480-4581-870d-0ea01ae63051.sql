-- Adicionar coluna cargo_grau_texto na tabela deltas_pendentes
ALTER TABLE public.deltas_pendentes 
ADD COLUMN cargo_grau_texto text;

-- Comentar a coluna
COMMENT ON COLUMN public.deltas_pendentes.cargo_grau_texto IS 'Cargo e grau do integrante no momento da detecção do delta';

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_deltas_pendentes_cargo_grau ON public.deltas_pendentes(cargo_grau_texto);

-- Atualizar deltas existentes com cargo_grau_texto dos afastados quando possível
UPDATE public.deltas_pendentes dp
SET cargo_grau_texto = ia.cargo_grau_texto
FROM public.integrantes_afastados ia
WHERE dp.registro_id = ia.registro_id
  AND dp.tipo_delta IN ('SUMIU_AFASTADOS', 'NOVO_AFASTADOS')
  AND dp.status = 'PENDENTE'
  AND dp.cargo_grau_texto IS NULL
  AND ia.ativo = true;