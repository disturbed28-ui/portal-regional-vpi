-- Adicionar coluna combate_insano separada de sgt_armas
ALTER TABLE public.integrantes_portal 
ADD COLUMN combate_insano BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN public.integrantes_portal.combate_insano IS 'Indica se o integrante faz parte do Combate Insano (diferente de SGT Armas)';