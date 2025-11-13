-- Adicionar coluna ordem para ordenação de links úteis
ALTER TABLE public.links_uteis 
ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0 NOT NULL;

-- Criar índice para melhor performance na ordenação
CREATE INDEX IF NOT EXISTS idx_links_uteis_ordem ON public.links_uteis(ordem);

-- Criar índice para ordenação combinada (ativo + ordem)
CREATE INDEX IF NOT EXISTS idx_links_uteis_ativo_ordem ON public.links_uteis(ativo, ordem);

-- Atualizar comentário da tabela com timestamp para forçar detecção
COMMENT ON TABLE public.links_uteis IS 'Links úteis do portal - última atualização: 2024-11-13 16:53:00';

-- Atualizar comentário da coluna ordem
COMMENT ON COLUMN public.links_uteis.ordem IS 'Ordem de exibição dos links (menor número aparece primeiro)';

-- Notificação
DO $$ 
BEGIN 
  RAISE NOTICE 'Coluna ordem adicionada com sucesso - types.ts será regenerado automaticamente';
END $$;