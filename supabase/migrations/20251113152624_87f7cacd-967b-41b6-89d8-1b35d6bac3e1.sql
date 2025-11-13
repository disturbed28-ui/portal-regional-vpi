-- Criar tabela links_uteis
CREATE TABLE public.links_uteis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.links_uteis ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem fazer tudo
CREATE POLICY "Admins podem gerenciar links_uteis"
ON public.links_uteis
FOR ALL
TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role))
WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Policy: Usuários autenticados podem visualizar links ativos
CREATE POLICY "Usuarios podem ver links ativos"
ON public.links_uteis
FOR SELECT
TO authenticated
USING (ativo = true);

-- Indexes para performance
CREATE INDEX idx_links_uteis_ativo ON public.links_uteis(ativo);
CREATE INDEX idx_links_uteis_created_at ON public.links_uteis(created_at DESC);

-- Registrar telas no sistema
INSERT INTO public.system_screens (nome, rota, descricao, icone, ordem, ativo)
VALUES 
  ('Links Úteis - Admin', '/admin/links-uteis', 'Gerenciar links úteis do portal', 'Link', 90, true),
  ('Links Úteis', '/links-uteis', 'Visualizar links úteis disponíveis', 'ExternalLink', 91, true);

-- Permissões para tela admin (apenas admin)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'admin'::app_role 
FROM public.system_screens 
WHERE rota = '/admin/links-uteis';

-- Permissões para tela pública (todos os roles autenticados)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (
  SELECT unnest(ARRAY['user', 'moderator', 'admin', 'diretor_regional', 'regional', 'diretor_divisao']) AS role
) r
WHERE s.rota = '/links-uteis';