-- Adicionar nova tela de Atualização de Integrantes na matriz de permissões
INSERT INTO system_screens (nome, rota, ordem, ativo)
VALUES ('Gestão ADM - Integrantes - Atualização', '/gestao-adm-integrantes-atualizacao', 22, true)
ON CONFLICT DO NOTHING;