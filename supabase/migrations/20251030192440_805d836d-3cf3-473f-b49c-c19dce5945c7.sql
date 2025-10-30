-- Adicionar campo telefone na tabela profiles
ALTER TABLE public.profiles ADD COLUMN telefone text;

-- Criar tabela de integrantes do portal
CREATE TABLE public.integrantes_portal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificacao unica do integrante no portal externo
  registro_id integer UNIQUE NOT NULL,
  
  -- Dados basicos
  nome_colete text NOT NULL,
  
  -- Estrutura organizacional (texto do portal)
  comando_texto text NOT NULL,
  regional_texto text NOT NULL,
  divisao_texto text NOT NULL,
  cargo_grau_texto text NOT NULL,
  
  -- Campos extraidos/parseados
  cargo_nome text,
  grau text,
  
  -- Vinculacao (preenchido quando integrante se cadastra no app)
  firebase_uid text,
  profile_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  vinculado boolean DEFAULT false,
  data_vinculacao timestamp with time zone,
  
  -- Controle
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indices para performance
CREATE INDEX idx_integrantes_registro ON public.integrantes_portal(registro_id);
CREATE INDEX idx_integrantes_nome_colete ON public.integrantes_portal(nome_colete);
CREATE INDEX idx_integrantes_vinculado ON public.integrantes_portal(vinculado);
CREATE INDEX idx_integrantes_profile_id ON public.integrantes_portal(profile_id);

-- Trigger para updated_at
CREATE TRIGGER update_integrantes_portal_updated_at
BEFORE UPDATE ON public.integrantes_portal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para integrantes_portal
ALTER TABLE public.integrantes_portal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to integrantes_portal"
ON public.integrantes_portal
FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert integrantes"
ON public.integrantes_portal
FOR INSERT
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can update integrantes"
ON public.integrantes_portal
FOR UPDATE
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can delete integrantes"
ON public.integrantes_portal
FOR DELETE
USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Criar tabela de historico de integrantes
CREATE TABLE public.integrantes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id uuid REFERENCES public.integrantes_portal(id),
  profile_id text REFERENCES public.profiles(id),
  acao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  alterado_por text,
  observacao text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para historico
ALTER TABLE public.integrantes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view integrantes historico"
ON public.integrantes_historico
FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Only admins can insert integrantes historico"
ON public.integrantes_historico
FOR INSERT
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));