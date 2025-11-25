-- ============================================================
-- Migration: Registrar tela Admin Ações Sociais Exclusões
-- Data: 2025-11-25
-- ============================================================

-- 1.1) Inserir a nova tela em system_screens
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo)
VALUES (
  'Admin Acoes Sociais Exclusoes',
  'Tela administrativa para revisar solicitacoes de exclusao de acoes sociais',
  '/admin/acoes-sociais/solicitacoes-exclusao',
  'AlertTriangle',
  40,
  true
)
ON CONFLICT (rota) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

-- 1.2) Vincular somente a role 'admin'
WITH screen AS (
  SELECT id FROM public.system_screens
  WHERE rota = '/admin/acoes-sociais/solicitacoes-exclusao'
)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT screen.id, 'admin'::public.app_role
FROM screen
ON CONFLICT (screen_id, role) DO NOTHING;