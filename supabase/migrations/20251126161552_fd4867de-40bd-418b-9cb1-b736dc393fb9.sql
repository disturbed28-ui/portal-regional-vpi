-- Criar tabela email_logs para auditoria centralizada de envios
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_nome TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  error_message TEXT,
  related_user_id UUID,
  related_divisao_id UUID,
  metadata JSONB,
  resend_message_id TEXT
);

-- Índices para performance
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_tipo ON public.email_logs(tipo);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_to_email ON public.email_logs(to_email);

-- RLS: Apenas admins podem ver
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os logs de email"
ON public.email_logs FOR SELECT
USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Sistema pode inserir logs de email"
ON public.email_logs FOR INSERT
WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.email_logs IS 'Logs centralizados de todos os envios de email via Resend';