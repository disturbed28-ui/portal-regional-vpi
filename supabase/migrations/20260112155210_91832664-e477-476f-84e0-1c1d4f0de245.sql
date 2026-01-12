-- Adicionar role admin à tela de importação de integrantes
INSERT INTO screen_permissions (screen_id, role)
SELECT id, 'admin'::app_role
FROM system_screens
WHERE rota = '/gestao-adm-integrantes-atualizacao'
ON CONFLICT (screen_id, role) DO NOTHING;