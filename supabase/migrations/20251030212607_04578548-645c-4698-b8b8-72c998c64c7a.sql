-- Adicionar diretor_regional ao enum se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'diretor_regional' 
    AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'diretor_regional';
  END IF;
END $$;

-- Criar tabela de histórico de cargas
CREATE TABLE IF NOT EXISTS public.cargas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_integrantes INTEGER NOT NULL,
  dados_snapshot JSONB NOT NULL,
  realizado_por TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de mensalidades em atraso
CREATE TABLE IF NOT EXISTS public.mensalidades_atraso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  registro_id INTEGER NOT NULL,
  nome_colete TEXT NOT NULL,
  divisao_texto TEXT NOT NULL,
  ref TEXT,
  data_vencimento DATE,
  valor DECIMAL(10,2),
  situacao TEXT,
  realizado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mensalidades_atraso_registro ON public.mensalidades_atraso(registro_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_atraso_data_carga ON public.mensalidades_atraso(data_carga);
CREATE INDEX IF NOT EXISTS idx_mensalidades_atraso_divisao ON public.mensalidades_atraso(divisao_texto);
CREATE INDEX IF NOT EXISTS idx_cargas_historico_data ON public.cargas_historico(data_carga);

-- RLS para cargas_historico
ALTER TABLE public.cargas_historico ENABLE ROW LEVEL SECURITY;

-- RLS para mensalidades_atraso
ALTER TABLE public.mensalidades_atraso ENABLE ROW LEVEL SECURITY;