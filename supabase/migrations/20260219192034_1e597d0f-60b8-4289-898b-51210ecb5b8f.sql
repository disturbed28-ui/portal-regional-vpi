ALTER TABLE acoes_sociais_registros 
ADD CONSTRAINT acoes_sociais_registros_hash_unique 
UNIQUE (hash_deduplicacao);