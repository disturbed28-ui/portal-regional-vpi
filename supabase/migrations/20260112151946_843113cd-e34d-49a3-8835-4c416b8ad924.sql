-- Adicionar role 'user' a todos os integrantes ativos do portal
-- que ainda não possuem essa role

INSERT INTO user_roles (user_id, role)
SELECT DISTINCT p.id, 'user'::app_role
FROM profiles p
INNER JOIN integrantes_portal ip ON ip.profile_id = p.id
WHERE ip.ativo = true
ON CONFLICT (user_id, role) DO NOTHING;