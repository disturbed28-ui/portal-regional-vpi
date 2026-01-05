-- Adicionar novas roles ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'social_divisao';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adm_divisao';