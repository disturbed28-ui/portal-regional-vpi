-- Adicionar tipos de evento faltantes com cores apropriadas e pesos válidos
INSERT INTO tipos_evento_peso (tipo, peso, cor, ativo, ordem, descricao)
VALUES 
  ('Pub', 0.8, '#22c55e', true, 4, 'Eventos sociais em bares e pubs'),
  ('Acao Social', 1.0, '#0ea5e9', true, 5, 'Ações sociais e comunitárias'),
  ('Bate e Volta', 0.9, '#f97316', true, 6, 'Viagens rápidas de bate e volta')
ON CONFLICT (tipo) DO UPDATE 
SET 
  cor = EXCLUDED.cor,
  descricao = EXCLUDED.descricao,
  ativo = true;