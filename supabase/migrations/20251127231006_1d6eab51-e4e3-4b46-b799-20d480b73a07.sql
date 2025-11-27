-- Adicionar nova tela no sistema de permissões
INSERT INTO system_screens (nome, descricao, rota, icone, ordem, ativo)
VALUES (
  'Relatório Semanal - Aba',
  'Aba de acompanhamento de envio dos relatórios semanais por divisão',
  '/relatorios/semanal-divisao',
  'FileText',
  11,
  true
);

-- Vincular permissões para admin, diretor_regional e regional
INSERT INTO screen_permissions (screen_id, role)
SELECT id, 'admin'::app_role FROM system_screens WHERE rota = '/relatorios/semanal-divisao'
UNION ALL
SELECT id, 'diretor_regional'::app_role FROM system_screens WHERE rota = '/relatorios/semanal-divisao'
UNION ALL
SELECT id, 'regional'::app_role FROM system_screens WHERE rota = '/relatorios/semanal-divisao';