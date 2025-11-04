-- Criar tabela para armazenar integrantes afastados temporariamente
CREATE TABLE public.integrantes_afastados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_id INTEGER NOT NULL,
  nome_colete TEXT NOT NULL,
  divisao_texto TEXT NOT NULL,
  cargo_grau_texto TEXT,
  tipo_afastamento TEXT NOT NULL DEFAULT 'Afastado',
  data_afastamento DATE NOT NULL,
  data_retorno_prevista DATE NOT NULL,
  data_retorno_efetivo DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  carga_historico_id UUID REFERENCES public.cargas_historico(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_integrantes_afastados_registro_id ON public.integrantes_afastados(registro_id);
CREATE INDEX idx_integrantes_afastados_ativo ON public.integrantes_afastados(ativo);
CREATE INDEX idx_integrantes_afastados_data_retorno ON public.integrantes_afastados(data_retorno_prevista);

-- Enable Row Level Security
ALTER TABLE public.integrantes_afastados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem ver todos afastamentos"
ON public.integrantes_afastados
FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Moderadores podem ver afastamentos"
ON public.integrantes_afastados
FOR SELECT
USING (has_role((auth.uid())::text, 'moderator'::app_role));

CREATE POLICY "Admins podem inserir afastamentos"
ON public.integrantes_afastados
FOR INSERT
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Admins podem atualizar afastamentos"
ON public.integrantes_afastados
FOR UPDATE
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Admins podem deletar afastamentos"
ON public.integrantes_afastados
FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_integrantes_afastados_updated_at
BEFORE UPDATE ON public.integrantes_afastados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();