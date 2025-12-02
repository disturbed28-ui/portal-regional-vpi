-- Criar entrada na system_screens para a aba Integrantes
INSERT INTO system_screens (nome, rota, descricao, ordem, ativo)
VALUES ('Aba Integrantes', '/relatorios/integrantes', 'Aba de listagem de integrantes dentro de Relatórios', 0, true)
ON CONFLICT (rota) DO NOTHING;

-- Adicionar permissões iniciais para roles que podem acessar a aba
INSERT INTO screen_permissions (screen_id, role)
SELECT 
  ss.id,
  unnest(ARRAY['diretor_regional', 'regional', 'diretor_divisao', 'moderator', 'admin']::app_role[])
FROM system_screens ss
WHERE ss.rota = '/relatorios/integrantes'
ON CONFLICT DO NOTHING;