-- Adicionar novas roles ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adm_regional';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'comando';