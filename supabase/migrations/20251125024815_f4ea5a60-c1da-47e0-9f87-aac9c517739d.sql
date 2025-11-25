-- ============================================================================
-- MIGRATION: Adicionar permissões para Lista de Presença
-- ============================================================================
-- 
-- Adiciona a "tela virtual" /lista-presenca à matriz de permissões.
-- Apenas usuários com roles: admin, moderator, diretor_divisao podem:
-- - Ver o botão "Lista de Presença" na Agenda
-- - Abrir a modal de Lista de Presença
--
-- O gerenciamento interno da lista continua usando a edge function
-- manage-presenca com suas próprias regras de negócio.
-- ============================================================================

-- Inserir tela virtual em system_screens
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo)
VALUES (
  'Gerenciar Lista de Presença',
  'Permissão para visualizar e abrir a lista de presença de eventos',
  '/lista-presenca',
  'Users',
  20,
  true
)
ON CONFLICT (rota) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

-- Adicionar permissões para as roles autorizadas
WITH screen AS (
  SELECT id FROM public.system_screens WHERE rota = '/lista-presenca'
)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT
  screen.id,
  unnest(ARRAY['admin', 'moderator', 'diretor_divisao']::public.app_role[])
FROM screen
ON CONFLICT (screen_id, role) DO NOTHING;