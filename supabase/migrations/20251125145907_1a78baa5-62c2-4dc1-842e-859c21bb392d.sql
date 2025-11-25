-- Criar tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração inicial para notificações por email
INSERT INTO public.system_settings (chave, valor, descricao) 
VALUES ('notificacoes_email_admin', true, 'Ativar/desativar notificações por email para administradores sobre erros críticos')
ON CONFLICT (chave) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ler configurações
CREATE POLICY "Admins podem ler configurações"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role((auth.uid())::text, 'admin'));

-- Política: apenas admins podem atualizar configurações
CREATE POLICY "Admins podem atualizar configurações"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role((auth.uid())::text, 'admin'))
  WITH CHECK (public.has_role((auth.uid())::text, 'admin'));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_system_settings_updated_at();