ALTER TABLE public.expansao_candidatos
  ADD COLUMN IF NOT EXISTS enviado_para_nome text,
  ADD COLUMN IF NOT EXISTS enviado_para_telefone text;