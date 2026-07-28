INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo) VALUES
('Pendências de Avaliação', 'Cobrar diretores de divisão sobre avaliações não finalizadas', '/gestao-adm/pendencias-avaliacao', 'AlertTriangle', 98, true)
ON CONFLICT (rota) DO NOTHING;

INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r.role::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'),('comando'),('diretor_regional'),('adm_regional')) AS r(role)
WHERE s.rota = '/gestao-adm/pendencias-avaliacao'
ON CONFLICT DO NOTHING;

INSERT INTO public.notificacoes_whatsapp_templates (chave, titulo, descricao, corpo, escopo, variaveis_disponiveis, ativo)
VALUES (
  'avaliacao_pendencia_dd',
  'Avaliação — Cobrança ao Diretor de Divisão',
  'Enviada ao Diretor de Divisão com a lista de integrantes com avaliação pendente no período',
  E'🎖️ *AVALIAÇÃO DE INTEGRANTES — PENDÊNCIA*\n\nCaro Diretor, {{diretor}}!\n\nA avaliação do período *{{periodo}}* está em aberto para a *{{divisao}}*.\n\nIntegrantes pendentes de finalização ({{total}}):\n{{lista}}\n\nPrazo do período: até *{{data_fim}}*.\n\nPor favor, finalize a avaliação desses integrantes no Portal:\nGestão ADM → Avaliação de Integrantes.\n\nQualquer dúvida, estou à disposição.\n{{remetente}}',
  'avaliacao',
  ARRAY['diretor','periodo','divisao','total','lista','data_fim','remetente'],
  true
)
ON CONFLICT (chave) DO UPDATE SET corpo = EXCLUDED.corpo, titulo = EXCLUDED.titulo, descricao = EXCLUDED.descricao, variaveis_disponiveis = EXCLUDED.variaveis_disponiveis, ativo = true;