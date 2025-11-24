-- Criar tabela de logs de sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  tipo text NOT NULL,
  origem text NOT NULL,
  rota text NULL,
  mensagem text NULL,
  detalhes jsonb NULL,
  notificacao_enviada boolean NOT NULL DEFAULT false,
  
  CONSTRAINT tipo_check CHECK (tipo IN (
    'AUTH_ERROR', 
    'PERMISSION_DENIED', 
    'FUNCTION_ERROR', 
    'NETWORK_ERROR',
    'VALIDATION_ERROR',
    'DATABASE_ERROR',
    'UNKNOWN_ERROR'
  ))
);

-- Índices para performance
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX idx_system_logs_tipo ON public.system_logs(tipo);
CREATE INDEX idx_system_logs_origem ON public.system_logs(origem);
CREATE INDEX idx_system_logs_user_id ON public.system_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_system_logs_notificacao ON public.system_logs(notificacao_enviada, created_at DESC) 
  WHERE notificacao_enviada = true;
CREATE INDEX idx_system_logs_rate_limit ON public.system_logs(tipo, rota, notificacao_enviada, created_at DESC);

-- Comentários
COMMENT ON TABLE public.system_logs IS 'Registro centralizado de eventos e erros do sistema';
COMMENT ON COLUMN public.system_logs.tipo IS 'Tipo do evento: AUTH_ERROR, PERMISSION_DENIED, FUNCTION_ERROR, etc.';
COMMENT ON COLUMN public.system_logs.origem IS 'Origem do log: frontend, edge:function-name, etc.';
COMMENT ON COLUMN public.system_logs.detalhes IS 'Dados adicionais em formato JSON (stack trace, headers, etc.)';

-- Habilitar RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuários autenticados podem INSERIR logs
CREATE POLICY "Usuarios autenticados podem inserir logs"
  ON public.system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política 2: Apenas admins podem VISUALIZAR logs
CREATE POLICY "Apenas admins podem visualizar logs"
  ON public.system_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid()::text 
        AND role = 'admin'::app_role
    )
  );

-- Política 3: Sistema pode atualizar (para marcar notificacao_enviada)
CREATE POLICY "Sistema pode atualizar notificacao_enviada"
  ON public.system_logs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 4: Apenas admins podem deletar (manutenção/limpeza)
CREATE POLICY "Apenas admins podem deletar logs"
  ON public.system_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid()::text 
        AND role = 'admin'::app_role
    )
  );