-- Adicionar coluna nome_colete (nullable para aceitar perfis existentes)
ALTER TABLE public.profiles 
ADD COLUMN nome_colete TEXT;

-- Adicionar coluna profile_status com valor padrão 'Pendente'
ALTER TABLE public.profiles 
ADD COLUMN profile_status TEXT NOT NULL DEFAULT 'Pendente';

-- Comentário: Novos campos para controle de perfil do usuário
-- nome_colete: apelido/nome de colete que o usuário escolhe
-- profile_status: controla o status do perfil (Pendente -> Analise)