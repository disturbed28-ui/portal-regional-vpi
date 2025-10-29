-- Adicionar campo observacao para armazenar motivos de recusa e notas administrativas
ALTER TABLE public.profiles 
ADD COLUMN observacao TEXT;

COMMENT ON COLUMN public.profiles.observacao IS 'Observações administrativas: motivo de recusa, notas sobre o membro, etc.';

-- Criar tabela profile_history para auditoria de mudanças de status
CREATE TABLE public.profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL,
  status_anterior TEXT NOT NULL,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  alterado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX idx_profile_history_profile_id ON public.profile_history(profile_id);
CREATE INDEX idx_profile_history_created_at ON public.profile_history(created_at DESC);

-- RLS: Apenas admins podem visualizar histórico
ALTER TABLE public.profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all history"
  ON public.profile_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (auth.uid())::text
        AND role = 'admin'
    )
  );

-- Trigger para registrar mudanças de status automaticamente
CREATE OR REPLACE FUNCTION log_profile_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.profile_status IS DISTINCT FROM NEW.profile_status THEN
    INSERT INTO public.profile_history (
      profile_id,
      status_anterior,
      status_novo,
      observacao,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.profile_status,
      NEW.profile_status,
      NEW.observacao,
      (auth.uid())::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER profile_status_change_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_status_change();

-- Política para admins atualizarem profile_status e observacao
CREATE POLICY "Admins can update profile_status and observacao"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (auth.uid())::text
        AND role = 'admin'
    )
  );