-- Passo 2: Atualizar registros existentes para usar o novo valor

-- Atualizar user_roles
UPDATE user_roles 
SET role = 'diretor_divisao' 
WHERE role = 'diretor_regional';

-- Atualizar screen_permissions
UPDATE screen_permissions 
SET role = 'diretor_divisao' 
WHERE role = 'diretor_regional';