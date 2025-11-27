-- ============================================
-- Integração de /relatorios e /organograma
-- à Matriz de Permissões
-- ============================================

-- 1. Registrar telas em system_screens
INSERT INTO public.system_screens (nome, descricao, rota, ativo, ordem)
VALUES 
  (
    'Relatórios',
    'Relatórios consolidados e estatísticas da Regional VP1',
    '/relatorios',
    true,
    10
  ),
  (
    'Organograma',
    'Organograma hierárquico da Regional VP1',
    '/organograma',
    true,
    11
  )
ON CONFLICT (rota) 
DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem;

-- 2. Criar permissões para /relatorios
-- (admin, moderator, diretor_regional, diretor_divisao, regional)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role
FROM public.system_screens s
CROSS JOIN (VALUES 
  ('admin'::app_role),
  ('moderator'::app_role),
  ('diretor_regional'::app_role),
  ('diretor_divisao'::app_role),
  ('regional'::app_role)
) AS r(role)
WHERE s.rota = '/relatorios'
ON CONFLICT (screen_id, role) DO NOTHING;

-- 3. Criar permissões para /organograma
-- (acesso mais amplo: incluindo 'user')
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role
FROM public.system_screens s
CROSS JOIN (VALUES 
  ('admin'::app_role),
  ('moderator'::app_role),
  ('diretor_regional'::app_role),
  ('diretor_divisao'::app_role),
  ('regional'::app_role),
  ('user'::app_role)
) AS r(role)
WHERE s.rota = '/organograma'
ON CONFLICT (screen_id, role) DO NOTHING;