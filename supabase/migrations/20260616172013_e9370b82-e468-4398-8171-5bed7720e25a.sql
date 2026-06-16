-- 1) Permitir tipo de carga 'desligados'
ALTER TABLE public.cargas_historico DROP CONSTRAINT IF EXISTS cargas_historico_tipo_carga_check;
ALTER TABLE public.cargas_historico ADD CONSTRAINT cargas_historico_tipo_carga_check
  CHECK (tipo_carga = ANY (ARRAY['integrantes'::text, 'afastados'::text, 'desligados'::text, 'outros'::text]));

-- 2) Novas telas
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo) VALUES
('Gestão ADM - Desligados Definitivos', 'Importar e gerenciar integrantes desligados/afastados definitivamente', '/gestao-adm-desligados', 'UserX', 88, true),
('Consultar Integrante', 'Consulta global de integrantes ativos e inativos por ID ou nome de colete', '/consulta-integrante', 'Search', 50, true)
ON CONFLICT (rota) DO NOTHING;

-- 3) Permissões da tela de Desligados (mesmos perfis da Atualização de Integrantes + comando)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'),('comando'),('diretor_regional'),('adm_regional'),('diretor_divisao'),('adm_divisao'),('regional')) AS r(role)
WHERE s.rota = '/gestao-adm-desligados'
ON CONFLICT DO NOTHING;

-- 4) Permissões da tela de Consulta (inicialmente Grau V)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'),('comando'),('diretor_regional'),('adm_regional'),('regional')) AS r(role)
WHERE s.rota = '/consulta-integrante'
ON CONFLICT DO NOTHING;