-- Adicionar roles técnicas ao ENUM app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'app.authenticated';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'presence.view_division';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'presence.view_region';