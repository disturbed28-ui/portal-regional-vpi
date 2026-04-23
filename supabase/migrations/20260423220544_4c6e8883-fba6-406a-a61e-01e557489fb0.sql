
INSERT INTO public.system_screens (rota, nome, descricao, ativo)
VALUES ('/cobranca-relatorios', 'Cobrança de Relatórios', 'Lista divisões com relatório do período pendente e permite enviar cobrança via WhatsApp', true)
ON CONFLICT (rota) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, ativo = true;

INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'), ('comando'), ('regional'), ('diretor_regional'), ('adm_regional')) AS r(role)
WHERE s.rota = '/cobranca-relatorios'
ON CONFLICT (screen_id, role) DO NOTHING;
