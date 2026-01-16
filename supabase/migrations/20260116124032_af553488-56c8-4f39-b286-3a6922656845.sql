-- Adicionar mapeamentos de cargo para as novas roles
INSERT INTO cargo_role_mapping (cargo_nome, cargo_nome_normalizado, app_role)
VALUES 
  ('Adm. Regional', 'adm regional', 'adm_regional'),
  ('Adm Regional', 'adm regional', 'adm_regional'),
  ('Administrativo Regional', 'administrativo regional', 'adm_regional'),
  ('ADM Regional (Grau V)', 'adm regional grau v', 'adm_regional')
ON CONFLICT DO NOTHING;