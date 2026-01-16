-- Opção 1: Reverter eventos antigos incorretamente marcados como "removed" para "active"
-- pois eles não foram realmente removidos, apenas saíram da janela de busca

UPDATE eventos_agenda
SET status = 'active',
    updated_at = NOW()
WHERE status = 'removed'
  AND data_evento < NOW() - INTERVAL '30 days';