-- Inserir telas de Estágio na matriz de permissões
INSERT INTO public.system_screens (nome, rota, ativo) VALUES
  ('Gestão ADM - Estágio', '/gestao-adm-estagio', true),
  ('Gestão ADM - Estágio - Solicitação', '/gestao-adm-estagio-solicitacao', true),
  ('Gestão ADM - Estágio - Aprovação', '/gestao-adm-estagio-aprovacao', true),
  ('Gestão ADM - Estágio - Encerramento', '/gestao-adm-estagio-encerramento', true),
  ('Gestão ADM - Estágio - Histórico', '/gestao-adm-estagio-historico', true),
  ('Gestão ADM - Estágio - Flyers', '/gestao-adm-estagio-flyers', true),
  ('Gestão ADM - Estágio - Flyers - Grau V', '/gestao-adm-estagio-flyers-grau5', true),
  ('Gestão ADM - Estágio - Flyers - Grau VI', '/gestao-adm-estagio-flyers-grau6', true),
  ('Gestão ADM - Estágio - Flyers - Fila Produção', '/gestao-adm-estagio-flyers-fila', true)
ON CONFLICT (rota) DO NOTHING;