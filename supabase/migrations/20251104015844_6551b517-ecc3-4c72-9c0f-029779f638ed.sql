-- Adicionar coluna justificativa_ausencia se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'presencas' 
    AND column_name = 'justificativa_ausencia'
  ) THEN
    ALTER TABLE public.presencas 
    ADD COLUMN justificativa_ausencia text;
  END IF;
END $$;

-- Adicionar constraint com todas as opções
ALTER TABLE public.presencas 
DROP CONSTRAINT IF EXISTS presencas_justificativa_ausencia_check;

ALTER TABLE public.presencas 
ADD CONSTRAINT presencas_justificativa_ausencia_check 
CHECK (justificativa_ausencia IN ('saude', 'trabalho', 'familia', 'nao_justificado'));