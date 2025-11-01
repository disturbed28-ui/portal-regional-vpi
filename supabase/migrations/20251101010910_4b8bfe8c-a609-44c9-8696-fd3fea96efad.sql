-- Criar tabela para eventos/listas de presença
CREATE TABLE IF NOT EXISTS public.eventos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id text NOT NULL UNIQUE,
  titulo text NOT NULL,
  data_evento timestamp with time zone NOT NULL,
  regional_id uuid REFERENCES public.regionais(id),
  divisao_id uuid REFERENCES public.divisoes(id),
  tipo_evento text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela para registrar presenças
CREATE TABLE IF NOT EXISTS public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_agenda_id uuid REFERENCES public.eventos_agenda(id) ON DELETE CASCADE NOT NULL,
  integrante_id uuid REFERENCES public.integrantes_portal(id) NOT NULL,
  profile_id text,
  confirmado_em timestamp with time zone DEFAULT now(),
  confirmado_por text,
  UNIQUE(evento_agenda_id, integrante_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_evento_id ON public.eventos_agenda(evento_id);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_divisao ON public.eventos_agenda(divisao_id);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_regional ON public.eventos_agenda(regional_id);
CREATE INDEX IF NOT EXISTS idx_presencas_evento ON public.presencas(evento_agenda_id);
CREATE INDEX IF NOT EXISTS idx_presencas_integrante ON public.presencas(integrante_id);

-- Enable RLS
ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para eventos_agenda
CREATE POLICY "Todos podem ver eventos"
  ON public.eventos_agenda FOR SELECT
  USING (true);

CREATE POLICY "Diretores e Grau V podem criar eventos"
  ON public.eventos_agenda FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.integrantes_portal ip ON p.id = ip.profile_id
      WHERE p.id = (auth.uid())::text
      AND (
        ip.cargo_nome IN ('Diretor de Divisao', 'Sub Diretor de Divisao')
        OR ip.grau = 'V'
      )
    )
  );

CREATE POLICY "Diretores e Grau V podem atualizar eventos"
  ON public.eventos_agenda FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.integrantes_portal ip ON p.id = ip.profile_id
      WHERE p.id = (auth.uid())::text
      AND (
        ip.cargo_nome IN ('Diretor de Divisao', 'Sub Diretor de Divisao')
        OR ip.grau = 'V'
      )
    )
  );

-- Políticas RLS para presencas
CREATE POLICY "Todos podem ver presenças"
  ON public.presencas FOR SELECT
  USING (true);

CREATE POLICY "Diretores e Grau V podem registrar presenças"
  ON public.presencas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.integrantes_portal ip ON p.id = ip.profile_id
      WHERE p.id = (auth.uid())::text
      AND (
        ip.cargo_nome IN ('Diretor de Divisao', 'Sub Diretor de Divisao')
        OR ip.grau = 'V'
      )
    )
  );

CREATE POLICY "Diretores e Grau V podem remover presenças"
  ON public.presencas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.integrantes_portal ip ON p.id = ip.profile_id
      WHERE p.id = (auth.uid())::text
      AND (
        ip.cargo_nome IN ('Diretor de Divisao', 'Sub Diretor de Divisao')
        OR ip.grau = 'V'
      )
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_eventos_agenda_updated_at
  BEFORE UPDATE ON public.eventos_agenda
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();