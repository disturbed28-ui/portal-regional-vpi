-- Criar tabela de telas/recursos do sistema
CREATE TABLE IF NOT EXISTS public.system_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  rota text NOT NULL UNIQUE,
  icone text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de permissões (relação muitos-para-muitos entre telas e roles)
CREATE TABLE IF NOT EXISTS public.screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid REFERENCES public.system_screens(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(screen_id, role)
);

-- Enable RLS
ALTER TABLE public.system_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para system_screens
CREATE POLICY "Todos podem ver telas"
  ON public.system_screens FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar telas"
  ON public.system_screens FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Políticas RLS para screen_permissions
CREATE POLICY "Todos podem ver permissões"
  ON public.screen_permissions FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar permissões"
  ON public.screen_permissions FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Inserir telas do sistema
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem) VALUES
  ('Página Inicial', 'Página inicial com perfil e QR code', '/', 'Home', 1),
  ('Organograma', 'Visualização da estrutura organizacional', '/organograma', 'Network', 2),
  ('Agenda Regional', 'Calendário de eventos da regional', '/agenda', 'Calendar', 3),
  ('Relatórios', 'Dashboard e relatórios de inadimplência', '/relatorios', 'BarChart', 4),
  ('Administração', 'Painel administrativo geral', '/admin', 'Shield', 5),
  ('Admin - Dados', 'Importação de dados e mensalidades', '/admin/dados', 'Database', 6),
  ('Admin - Estrutura', 'Gerenciamento de estrutura organizacional', '/admin/estrutura', 'Building', 7),
  ('Admin - Integrantes', 'Gerenciamento de perfis de integrantes', '/admin/integrantes', 'Users', 8),
  ('Perfil Pessoal', 'Visualização do próprio perfil', '/perfil', 'User', 9)
ON CONFLICT (rota) DO NOTHING;

-- Configurar permissões padrão
-- Admin tem acesso a tudo
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'admin'::app_role FROM public.system_screens
ON CONFLICT DO NOTHING;

-- Moderador tem acesso a algumas telas
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'moderator'::app_role FROM public.system_screens 
WHERE rota IN ('/', '/organograma', '/agenda', '/relatorios', '/perfil', '/admin/integrantes')
ON CONFLICT DO NOTHING;

-- Diretor regional tem acesso específico
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'diretor_regional'::app_role FROM public.system_screens 
WHERE rota IN ('/', '/organograma', '/agenda', '/relatorios', '/perfil')
ON CONFLICT DO NOTHING;

-- Usuário comum tem acesso básico
INSERT INTO public.screen_permissions (screen_id, role)
SELECT id, 'user'::app_role FROM public.system_screens 
WHERE rota IN ('/', '/organograma', '/agenda', '/perfil')
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_screens_updated_at
  BEFORE UPDATE ON public.system_screens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();