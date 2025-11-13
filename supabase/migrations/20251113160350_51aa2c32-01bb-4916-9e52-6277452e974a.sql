-- Forçar regeneração de types.ts
-- Adiciona comentário à tabela para disparar atualização do schema
COMMENT ON TABLE public.links_uteis IS 'Tabela de links úteis do portal - permite gerenciar links externos acessíveis aos usuários';

-- Forçar reload do schema
DO $$ 
BEGIN 
  RAISE NOTICE 'Schema reload triggered for types.ts regeneration';
END $$;