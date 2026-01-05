-- Inserir telas virtuais para abas principais de Gestão ADM
INSERT INTO system_screens (nome, rota, descricao, ativo, ordem) VALUES
('Gestão ADM - Integrantes', '/gestao-adm-integrantes', 'Aba de gestão de integrantes', true, 12.1),
('Gestão ADM - Inadimplência', '/gestao-adm-inadimplencia', 'Aba de gestão de inadimplência', true, 12.2),
('Gestão ADM - Treinamento', '/gestao-adm-treinamento', 'Aba de gestão de treinamento', true, 12.3),
('Gestão ADM - Aniversariantes', '/gestao-adm-aniversariantes', 'Aba de aniversariantes', true, 12.4);

-- Inserir sub-abas de Integrantes
INSERT INTO system_screens (nome, rota, descricao, ativo, ordem) VALUES
('Gestão ADM - Integrantes - Lista', '/gestao-adm-integrantes-lista', 'Sub-aba lista de integrantes', true, 12.11),
('Gestão ADM - Integrantes - Histórico', '/gestao-adm-integrantes-historico', 'Sub-aba histórico de alterações', true, 12.12);

-- Inserir sub-abas de Treinamento
INSERT INTO system_screens (nome, rota, descricao, ativo, ordem) VALUES
('Gestão ADM - Treinamento - Solicitação', '/gestao-adm-treinamento-solicitacao', 'Sub-aba solicitação de treinamento', true, 12.31),
('Gestão ADM - Treinamento - Aprovação', '/gestao-adm-treinamento-aprovacao', 'Sub-aba aprovações pendentes', true, 12.32),
('Gestão ADM - Treinamento - Encerramento', '/gestao-adm-treinamento-encerramento', 'Sub-aba encerramento de treinamento', true, 12.33),
('Gestão ADM - Treinamento - Histórico', '/gestao-adm-treinamento-historico', 'Sub-aba histórico de treinamentos', true, 12.34);