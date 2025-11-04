-- Criar tabela de pesos de justificativas
CREATE TABLE IF NOT EXISTS public.justificativas_peso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  peso DECIMAL(5,4) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  cor TEXT DEFAULT '#gray',
  icone TEXT,
  ordem INTEGER DEFAULT 0,
  bloqueado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT peso_range CHECK (peso >= 0 AND peso <= 1)
);

-- Criar tabela de pesos de tipos de evento
CREATE TABLE IF NOT EXISTS public.tipos_evento_peso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  peso DECIMAL(5,4) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  cor TEXT DEFAULT '#gray',
  icone TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT peso_evento_range CHECK (peso >= 0 AND peso <= 1)
);

-- Inserir dados iniciais de justificativas
INSERT INTO public.justificativas_peso (tipo, descricao, peso, cor, icone, ordem, bloqueado) VALUES
  ('Presente', 'Compareceu ao evento', 1.0, '#22c55e', 'Check', 0, true),
  ('Saúde', 'Problemas de saúde pessoal ou familiar', 0.75, '#3b82f6', 'Heart', 1, false),
  ('Trabalho', 'Compromissos profissionais inadiáveis', 0.5, '#f59e0b', 'Briefcase', 2, false),
  ('Família', 'Questões familiares urgentes', 0.4, '#8b5cf6', 'Users', 3, false),
  ('Não justificou', 'Ausência sem justificativa', 0.001, '#ef4444', 'X', 99, true)
ON CONFLICT (tipo) DO NOTHING;

-- Inserir dados iniciais de tipos de evento
INSERT INTO public.tipos_evento_peso (tipo, descricao, peso, cor, icone, ordem) VALUES
  ('Coletamento', 'Coletamento oficial', 1.0, '#dc2626', 'Users', 1),
  ('Treinamento', 'Treinamentos obrigatórios', 1.0, '#16a34a', 'GraduationCap', 2),
  ('Bonde', 'Eventos de bonde', 0.75, '#9333ea', 'Bike', 3),
  ('Social', 'Eventos sociais', 0.75, '#0ea5e9', 'PartyPopper', 4),
  ('Reuniao', 'Reuniões administrativas', 0.5, '#eab308', 'MessageSquare', 5)
ON CONFLICT (tipo) DO NOTHING;

-- Adicionar coluna em presencas
ALTER TABLE public.presencas 
ADD COLUMN IF NOT EXISTS justificativa_tipo TEXT;

-- Adicionar coluna em eventos_agenda
ALTER TABLE public.eventos_agenda 
ADD COLUMN IF NOT EXISTS tipo_evento_peso TEXT;

-- Migrar dados existentes em presencas
UPDATE public.presencas 
SET justificativa_tipo = CASE 
  WHEN status = 'presente' THEN 'Presente'
  WHEN justificativa_ausencia ILIKE '%saúde%' OR justificativa_ausencia ILIKE '%saude%' THEN 'Saúde'
  WHEN justificativa_ausencia ILIKE '%trabalho%' THEN 'Trabalho'
  WHEN justificativa_ausencia ILIKE '%família%' OR justificativa_ausencia ILIKE '%familia%' THEN 'Família'
  WHEN status = 'ausente' AND justificativa_ausencia IS NOT NULL AND trim(justificativa_ausencia) != '' THEN 'Não justificou'
  WHEN status = 'ausente' THEN 'Não justificou'
  ELSE 'Presente'
END
WHERE justificativa_tipo IS NULL;

-- Migrar dados existentes em eventos_agenda
UPDATE public.eventos_agenda
SET tipo_evento_peso = CASE
  WHEN tipo_evento ILIKE '%coletamento%' OR tipo_evento ILIKE '%acao%' THEN 'Coletamento'
  WHEN tipo_evento ILIKE '%treinamento%' OR tipo_evento ILIKE '%treino%' THEN 'Treinamento'
  WHEN tipo_evento ILIKE '%bonde%' THEN 'Bonde'
  WHEN tipo_evento ILIKE '%social%' OR tipo_evento ILIKE '%pub%' OR tipo_evento ILIKE '%churrasco%' THEN 'Social'
  WHEN tipo_evento ILIKE '%reuniao%' OR tipo_evento ILIKE '%reunião%' THEN 'Reuniao'
  ELSE 'Reuniao'
END
WHERE tipo_evento_peso IS NULL;

-- RLS para justificativas_peso
ALTER TABLE public.justificativas_peso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver justificativas"
  ON public.justificativas_peso FOR SELECT 
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar justificativas"
  ON public.justificativas_peso FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role));

-- RLS para tipos_evento_peso
ALTER TABLE public.tipos_evento_peso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver tipos de evento"
  ON public.tipos_evento_peso FOR SELECT 
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar tipos"
  ON public.tipos_evento_peso FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role));

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_presencas_justificativa_tipo ON public.presencas(justificativa_tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_peso ON public.eventos_agenda(tipo_evento_peso);
CREATE INDEX IF NOT EXISTS idx_justificativas_ativo ON public.justificativas_peso(ativo);
CREATE INDEX IF NOT EXISTS idx_tipos_evento_ativo ON public.tipos_evento_peso(ativo);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_justificativas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_justificativas_peso_updated_at
  BEFORE UPDATE ON public.justificativas_peso
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_justificativas();

CREATE OR REPLACE FUNCTION update_updated_at_tipos_evento()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tipos_evento_peso_updated_at
  BEFORE UPDATE ON public.tipos_evento_peso
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_tipos_evento();