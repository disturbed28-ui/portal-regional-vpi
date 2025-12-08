-- =============================================
-- 1. NOVA TABELA: user_access_logs
-- =============================================
CREATE TABLE public.user_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT NOT NULL,
  tipo_evento TEXT NOT NULL,
  rota TEXT,
  origem TEXT NOT NULL DEFAULT 'frontend',
  user_agent TEXT,
  extras JSONB
);

-- Índices para performance
CREATE INDEX idx_user_access_logs_user_id_created_at 
  ON public.user_access_logs(user_id, created_at DESC);
CREATE INDEX idx_user_access_logs_created_at 
  ON public.user_access_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs de acesso
CREATE POLICY "Apenas admins podem ver logs de acesso"
  ON public.user_access_logs FOR SELECT
  USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Sistema pode inserir logs de acesso (usuários autenticados)
CREATE POLICY "Usuarios autenticados podem inserir logs de acesso"
  ON public.user_access_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = (auth.uid())::text);

-- =============================================
-- 2. NOVO CAMPO em profiles: last_access_at
-- =============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;

-- Índice para ordenação por último acesso
CREATE INDEX IF NOT EXISTS idx_profiles_last_access_at 
  ON public.profiles(last_access_at DESC NULLS LAST);