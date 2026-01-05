-- Criar tabela para pendências de ajuste de roles quando cargo é alterado
CREATE TABLE IF NOT EXISTS public.pendencias_ajuste_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integrante_id UUID NOT NULL REFERENCES integrantes_portal(id) ON DELETE CASCADE,
  integrante_nome_colete TEXT NOT NULL,
  integrante_divisao_texto TEXT NOT NULL,
  integrante_registro_id INTEGER NOT NULL,
  cargo_anterior TEXT,
  cargo_novo TEXT NOT NULL,
  grau_anterior TEXT,
  grau_novo TEXT,
  alterado_por UUID NOT NULL,
  justificativa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  resolvido_por UUID,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pendencias_ajuste_roles ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admin pode visualizar todas as pendências
CREATE POLICY "Admins can view all pendencias_ajuste_roles" 
ON public.pendencias_ajuste_roles
FOR SELECT 
TO authenticated
USING (public.has_role((auth.uid())::text, 'admin'::app_role));

-- Política: Usuários autenticados podem criar pendências (ao alterar cargo)
CREATE POLICY "Authenticated users can create pendencias_ajuste_roles" 
ON public.pendencias_ajuste_roles
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Política: Apenas admin pode atualizar (resolver) pendências
CREATE POLICY "Admins can update pendencias_ajuste_roles" 
ON public.pendencias_ajuste_roles
FOR UPDATE 
TO authenticated
USING (public.has_role((auth.uid())::text, 'admin'::app_role));