-- Forçar regeneração de types.ts com alteração estrutural real
-- Adicionar coluna temporária
ALTER TABLE public.links_uteis ADD COLUMN IF NOT EXISTS _force_update boolean DEFAULT false;

-- Remover coluna temporária imediatamente
ALTER TABLE public.links_uteis DROP COLUMN IF EXISTS _force_update;

-- Atualizar comentário para garantir mudança
COMMENT ON TABLE public.links_uteis IS 'Tabela de links úteis do portal - versão 2024-11-13';

-- Notificação de alteração estrutural
DO $$ 
BEGIN 
  RAISE NOTICE 'Alteração estrutural executada - types.ts será regenerado automaticamente';
END $$;