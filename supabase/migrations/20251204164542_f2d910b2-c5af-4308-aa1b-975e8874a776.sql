-- Adicionar campo valor_texto na tabela system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS valor_texto text;

-- Inserir configuração inicial da planilha
INSERT INTO public.system_settings (chave, valor, valor_texto, descricao)
VALUES (
  'google_sheets_acoes_sociais_id',
  true,
  '1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo',
  'ID da planilha do Google Sheets para importação de ações sociais'
)
ON CONFLICT (chave) DO UPDATE SET 
  valor_texto = EXCLUDED.valor_texto,
  descricao = EXCLUDED.descricao;