-- Criar tabela para armazenar detalhes das atualizações
CREATE TABLE IF NOT EXISTS public.atualizacoes_carga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_historico_id UUID REFERENCES public.cargas_historico(id) ON DELETE CASCADE,
  integrante_id UUID REFERENCES public.integrantes_portal(id),
  registro_id INTEGER NOT NULL,
  nome_colete TEXT NOT NULL,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_atualizacoes_carga_historico ON public.atualizacoes_carga(carga_historico_id);
CREATE INDEX IF NOT EXISTS idx_atualizacoes_registro ON public.atualizacoes_carga(registro_id);

-- Habilitar RLS
ALTER TABLE public.atualizacoes_carga ENABLE ROW LEVEL SECURITY;

-- Política para admins e moderadores verem atualizações
CREATE POLICY "Admins e moderadores podem ver atualizacoes"
ON public.atualizacoes_carga FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR 
  has_role((auth.uid())::text, 'moderator'::app_role)
);

-- Política para admins inserirem atualizações
CREATE POLICY "Admins podem inserir atualizacoes"
ON public.atualizacoes_carga FOR INSERT
TO authenticated
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Atualizar política RLS de cargas_historico para incluir moderadores
DROP POLICY IF EXISTS "Admins e diretores podem ver cargas historico" ON public.cargas_historico;

CREATE POLICY "Admins, diretores e moderadores podem ver cargas"
ON public.cargas_historico FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role) OR 
  has_role((auth.uid())::text, 'diretor_regional'::app_role) OR
  has_role((auth.uid())::text, 'moderator'::app_role)
);