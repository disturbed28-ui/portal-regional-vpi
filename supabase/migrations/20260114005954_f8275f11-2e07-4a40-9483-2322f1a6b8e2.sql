-- Adicionar coluna global para formulários multi-regional
ALTER TABLE formularios_catalogo 
ADD COLUMN global boolean DEFAULT false NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN formularios_catalogo.global IS 
  'Se true, o formulário aparece para todas as regionais (respeitando roles_permitidas)';