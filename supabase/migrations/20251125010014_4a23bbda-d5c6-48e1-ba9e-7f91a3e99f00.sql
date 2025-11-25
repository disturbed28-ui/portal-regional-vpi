-- Adicionar permissões faltantes para /agenda
-- Garantir que TODOS os app_roles tenham acesso à Agenda

WITH screen AS (
  SELECT id FROM system_screens WHERE rota = '/agenda'
)
INSERT INTO screen_permissions (screen_id, role)
SELECT 
  screen.id,
  unnest(ARRAY[
    'diretor_divisao',
    'regional',
    'app.authenticated',
    'presence.view_division',
    'presence.view_region'
  ]::app_role[])
FROM screen
ON CONFLICT (screen_id, role) DO NOTHING;