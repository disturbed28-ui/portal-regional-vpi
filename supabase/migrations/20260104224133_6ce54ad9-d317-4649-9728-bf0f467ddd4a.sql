-- 1. Adicionar coluna cargo_treinamento_id em integrantes_portal
ALTER TABLE public.integrantes_portal 
ADD COLUMN cargo_treinamento_id uuid REFERENCES public.cargos(id);

-- 2. Criar tabela de solicitações de treinamento
CREATE TABLE public.solicitacoes_treinamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id uuid NOT NULL REFERENCES public.integrantes_portal(id) ON DELETE CASCADE,
  divisao_id uuid REFERENCES public.divisoes(id),
  regional_id uuid REFERENCES public.regionais(id),
  cargo_atual_id uuid REFERENCES public.cargos(id),
  cargo_treinamento_id uuid NOT NULL REFERENCES public.cargos(id),
  solicitante_integrante_id uuid REFERENCES public.integrantes_portal(id),
  solicitante_nome_colete text NOT NULL,
  solicitante_cargo_id uuid REFERENCES public.cargos(id),
  solicitante_divisao_id uuid REFERENCES public.divisoes(id),
  data_hora_solicitacao timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Em Aprovacao',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Criar tabela de histórico de treinamentos
CREATE TABLE public.treinamentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id uuid NOT NULL REFERENCES public.integrantes_portal(id) ON DELETE CASCADE,
  cargo_treinamento_id uuid NOT NULL REFERENCES public.cargos(id),
  tipo_encerramento text NOT NULL,
  observacoes text NOT NULL,
  encerrado_por uuid REFERENCES public.integrantes_portal(id),
  encerrado_por_nome_colete text,
  data_inicio timestamptz,
  data_encerramento timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Habilitar RLS
ALTER TABLE public.solicitacoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos_historico ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para solicitacoes_treinamento
CREATE POLICY "Admins podem gerenciar solicitacoes" 
ON public.solicitacoes_treinamento 
FOR ALL 
USING (has_role((auth.uid())::text, 'admin'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuarios autenticados podem ver solicitacoes da sua regional" 
ON public.solicitacoes_treinamento 
FOR SELECT 
USING (
  regional_id IN (
    SELECT p.regional_id 
    FROM profiles p 
    WHERE p.id = (auth.uid())::text
  )
);

CREATE POLICY "Usuarios autenticados podem criar solicitacoes" 
ON public.solicitacoes_treinamento 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Políticas para treinamentos_historico
CREATE POLICY "Admins podem gerenciar historico" 
ON public.treinamentos_historico 
FOR ALL 
USING (has_role((auth.uid())::text, 'admin'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Usuarios autenticados podem ver historico" 
ON public.treinamentos_historico 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem inserir historico" 
ON public.treinamentos_historico 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Trigger para updated_at em solicitacoes_treinamento
CREATE TRIGGER update_solicitacoes_treinamento_updated_at
BEFORE UPDATE ON public.solicitacoes_treinamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Habilitar realtime para solicitacoes_treinamento
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_treinamento;