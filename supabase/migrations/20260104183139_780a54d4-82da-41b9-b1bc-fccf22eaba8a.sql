-- Registrar a tela no system_screens
INSERT INTO system_screens (nome, rota, descricao, icone, ordem, ativo)
VALUES (
  'Gestão ADM',
  '/gestao-adm',
  'Página de gestão interna para Diretores Regionais',
  'ClipboardList',
  12,
  true
);

-- Dar acesso a diretor_regional
INSERT INTO screen_permissions (screen_id, role)
SELECT id, 'diretor_regional'
FROM system_screens
WHERE rota = '/gestao-adm';

-- Dar acesso a admin para gerenciamento
INSERT INTO screen_permissions (screen_id, role)
SELECT id, 'admin'
FROM system_screens
WHERE rota = '/gestao-adm';