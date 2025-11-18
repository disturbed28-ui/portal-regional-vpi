-- Criar tabela de configuração de tipos de delta
CREATE TABLE IF NOT EXISTS public.tipos_delta_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT '📋',
  cor TEXT DEFAULT '#6b7280',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  bloqueado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de ações de resolução por tipo de delta
CREATE TABLE IF NOT EXISTS public.acoes_resolucao_delta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_delta_codigo TEXT NOT NULL,
  codigo_acao TEXT NOT NULL,
  label TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tipo_delta_codigo, codigo_acao)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tipos_delta_codigo ON public.tipos_delta_config(codigo);
CREATE INDEX IF NOT EXISTS idx_acoes_tipo_delta ON public.acoes_resolucao_delta(tipo_delta_codigo);

-- Enable RLS
ALTER TABLE public.tipos_delta_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acoes_resolucao_delta ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Todos podem ler, apenas admins podem escrever
CREATE POLICY "Todos podem ver tipos de delta"
  ON public.tipos_delta_config
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar tipos de delta"
  ON public.tipos_delta_config
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Todos podem ver ações de resolução"
  ON public.acoes_resolucao_delta
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem gerenciar ações de resolução"
  ON public.acoes_resolucao_delta
  FOR ALL
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_tipos_delta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_acoes_delta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tipos_delta_config_updated_at
  BEFORE UPDATE ON public.tipos_delta_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_tipos_delta();

CREATE TRIGGER update_acoes_resolucao_delta_updated_at
  BEFORE UPDATE ON public.acoes_resolucao_delta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_acoes_delta();

-- Inserir dados iniciais: 4 tipos de delta
INSERT INTO public.tipos_delta_config (codigo, nome, descricao, icone, cor, ordem, bloqueado) VALUES
  ('SUMIU_ATIVOS', 'Sumiu dos Ativos', 'Integrante que estava na lista de ativos e desapareceu na nova carga', '🚨', '#dc2626', 1, true),
  ('SUMIU_AFASTADOS', 'Sumiu dos Afastados', 'Integrante que estava na lista de afastados e desapareceu na nova carga', '↩️', '#ea580c', 2, true),
  ('NOVO_ATIVOS', 'Novo Ativo', 'Integrante que apareceu pela primeira vez na lista de ativos', '🆕', '#16a34a', 3, true),
  ('NOVO_AFASTADOS', 'Novo Afastado', 'Integrante que apareceu pela primeira vez na lista de afastados', '⏸️', '#2563eb', 4, true);

-- Inserir ações de resolução: 13 ações no total
-- SUMIU_ATIVOS: 5 ações
INSERT INTO public.acoes_resolucao_delta (tipo_delta_codigo, codigo_acao, label, descricao, ordem) VALUES
  ('SUMIU_ATIVOS', 'transferido', '📤 Transferido para outra divisão/regional', 'Integrante foi transferido para outra divisão ou regional', 1),
  ('SUMIU_ATIVOS', 'desligamento', '👋 Pediu desligamento voluntário', 'Integrante solicitou desligamento do clube', 2),
  ('SUMIU_ATIVOS', 'expulso', '⛔ Foi expulso do clube', 'Integrante foi expulso por decisão do clube', 3),
  ('SUMIU_ATIVOS', 'afastado', '⏸️ Passou para lista de afastados', 'Integrante foi movido para a lista de afastados', 4),
  ('SUMIU_ATIVOS', 'erro_planilha', '📋 Erro na planilha de carga', 'Erro na importação da planilha, integrante deve continuar ativo', 5);

-- SUMIU_AFASTADOS: 3 ações
INSERT INTO public.acoes_resolucao_delta (tipo_delta_codigo, codigo_acao, label, descricao, ordem) VALUES
  ('SUMIU_AFASTADOS', 'retornou', 'Retornou ao clube', 'Integrante retornou e voltou à ativa', 1),
  ('SUMIU_AFASTADOS', 'saiu', 'Saiu do clube', 'Integrante saiu definitivamente do clube', 2),
  ('SUMIU_AFASTADOS', 'erro', 'Erro de planilha', 'Erro na importação, integrante continua afastado', 3);

-- NOVO_AFASTADOS: 1 ação
INSERT INTO public.acoes_resolucao_delta (tipo_delta_codigo, codigo_acao, label, descricao, ordem) VALUES
  ('NOVO_AFASTADOS', 'confirmar', 'Confirmar afastamento', 'Confirmar que é um novo afastamento válido', 1);

-- NOVO_ATIVOS: 3 ações
INSERT INTO public.acoes_resolucao_delta (tipo_delta_codigo, codigo_acao, label, descricao, ordem) VALUES
  ('NOVO_ATIVOS', 'confirmar_novo', 'Confirmar novo integrante ativo', 'Confirmar que é um novo integrante válido', 1),
  ('NOVO_ATIVOS', 'retorno_afastamento', 'Retorno de afastamento', 'Integrante estava afastado e retornou', 2),
  ('NOVO_ATIVOS', 'erro_planilha', 'Erro na planilha de carga', 'Erro na importação da planilha', 3);