-- ============================================================================
-- PADRONIZAR CONTROLE DE ACESSO ADMIN
-- Manter apenas a tela /admin na matriz de permissões
-- ============================================================================

-- 1. Deletar permissões vinculadas às subrotas admin que serão removidas
DELETE FROM public.screen_permissions
WHERE screen_id IN (
  SELECT id FROM public.system_screens
  WHERE rota IN (
    '/admin/dados',
    '/admin/estrutura',
    '/admin/formularios',
    '/admin/integrantes',
    '/admin/links-uteis',
    '/admin/permissoes',
    '/admin/acoes-sociais/solicitacoes-exclusao'
  )
);

-- 2. Deletar as entradas de subrotas admin em system_screens
DELETE FROM public.system_screens
WHERE rota IN (
  '/admin/dados',
  '/admin/estrutura',
  '/admin/formularios',
  '/admin/integrantes',
  '/admin/links-uteis',
  '/admin/permissoes',
  '/admin/acoes-sociais/solicitacoes-exclusao'
);

-- 3. Garantir que existe o registro /admin com as informações corretas
INSERT INTO public.system_screens (rota, nome, descricao, ativo, icone, ordem)
VALUES (
  '/admin',
  'Admin',
  'Painel administrativo Regional VP1',
  true,
  'Shield',
  100
)
ON CONFLICT (rota) 
DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo,
  icone = EXCLUDED.icone,
  updated_at = now();

-- 4. Garantir que a role 'admin' tem acesso à tela /admin
INSERT INTO public.screen_permissions (screen_id, role)
SELECT 
  s.id,
  'admin'::app_role
FROM public.system_screens s
WHERE s.rota = '/admin'
ON CONFLICT (screen_id, role) DO NOTHING;