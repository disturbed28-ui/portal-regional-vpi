-- Criar enum para motivos de inativação
CREATE TYPE motivo_inativacao AS ENUM (
  'transferido',
  'falecido',
  'desligado',
  'expulso',
  'afastado',
  'promovido',
  'outro'
);

-- Adicionar colunas para rastrear inativações
ALTER TABLE integrantes_portal 
ADD COLUMN motivo_inativacao motivo_inativacao,
ADD COLUMN data_inativacao timestamp with time zone;