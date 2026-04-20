
-- =============================================
-- TABELA: notificacoes_whatsapp_templates
-- =============================================
CREATE TABLE public.notificacoes_whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  corpo text NOT NULL,
  escopo text NOT NULL DEFAULT 'generico',
  variaveis_disponiveis text[] DEFAULT ARRAY[]::text[],
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ler templates whatsapp"
  ON public.notificacoes_whatsapp_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Apenas admin gerencia templates whatsapp"
  ON public.notificacoes_whatsapp_templates FOR ALL
  TO authenticated
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

CREATE TRIGGER trg_notif_wa_templates_updated
  BEFORE UPDATE ON public.notificacoes_whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: notificacoes_whatsapp_log
-- =============================================
CREATE TABLE public.notificacoes_whatsapp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_profile_id text NOT NULL,
  remetente_nome text,
  destinatario_profile_id text,
  destinatario_nome text NOT NULL,
  destinatario_telefone text NOT NULL,
  template_chave text NOT NULL,
  template_titulo text,
  mensagem_renderizada text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  modulo_origem text NOT NULL DEFAULT 'generico',
  regional_id uuid,
  divisao_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_wa_log_remetente ON public.notificacoes_whatsapp_log(remetente_profile_id, created_at DESC);
CREATE INDEX idx_notif_wa_log_modulo ON public.notificacoes_whatsapp_log(modulo_origem, created_at DESC);
CREATE INDEX idx_notif_wa_log_regional ON public.notificacoes_whatsapp_log(regional_id, created_at DESC);

ALTER TABLE public.notificacoes_whatsapp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insere proprio log whatsapp"
  ON public.notificacoes_whatsapp_log FOR INSERT
  TO authenticated
  WITH CHECK (remetente_profile_id = (auth.uid())::text);

CREATE POLICY "Admin ve todos logs whatsapp"
  ON public.notificacoes_whatsapp_log FOR SELECT
  TO authenticated
  USING (has_role((auth.uid())::text, 'admin'::app_role));

CREATE POLICY "Regional ve logs da propria regional"
  ON public.notificacoes_whatsapp_log FOR SELECT
  TO authenticated
  USING (
    (has_role((auth.uid())::text, 'diretor_regional'::app_role)
     OR has_role((auth.uid())::text, 'adm_regional'::app_role)
     OR has_role((auth.uid())::text, 'regional'::app_role))
    AND regional_id IN (SELECT p.regional_id FROM profiles p WHERE p.id = (auth.uid())::text)
  );

CREATE POLICY "Remetente ve proprios envios whatsapp"
  ON public.notificacoes_whatsapp_log FOR SELECT
  TO authenticated
  USING (remetente_profile_id = (auth.uid())::text);

-- =============================================
-- SEEDS de templates iniciais
-- =============================================
INSERT INTO public.notificacoes_whatsapp_templates (chave, titulo, descricao, corpo, escopo, variaveis_disponiveis) VALUES
('generico',
 'Mensagem Genérica',
 'Mensagem livre para qualquer integrante.',
 E'Olá {{nome}}, tudo bem?\n\n',
 'generico',
 ARRAY['nome']),

('relatorios_cobranca',
 'Cobrança de Relatório de Período',
 'Cobrança ao Diretor de Divisão para fechar o relatório do período (8/18/28).',
 E'Olá {{nome}},\n\nLembrete: o relatório da *{{divisao}}* referente ao período *{{periodo}}* ainda não foi fechado.\n\nPor favor, providencie o fechamento o quanto antes.\n\nObrigado!',
 'relatorios',
 ARRAY['nome','divisao','periodo']),

('mensalidade_adm_divisao',
 'Cobrança a ADM de Divisão',
 'ADM Regional aciona o ADM da divisão sobre integrantes inadimplentes.',
 E'Olá {{nome}},\n\nA *{{divisao}}* possui *{{qtd_devedores}}* integrante(s) com mensalidade em aberto, totalizando *R$ {{valor_total}}*.\n\nPor favor, alinhe a regularização com os integrantes.\n\nObrigado!',
 'mensalidades',
 ARRAY['nome','divisao','qtd_devedores','valor_total']),

('mensalidade_integrante',
 'Cobrança ao Integrante Devedor',
 'Notificação direta ao integrante com mensalidade em aberto.',
 E'Olá {{nome}},\n\nIdentificamos *{{qtd_parcelas}}* parcela(s) de mensalidade em aberto, totalizando *R$ {{valor_total}}* ({{dias_atraso}} dias de atraso).\n\nPor favor, regularize o quanto antes para evitar consequências.\n\nObrigado!',
 'mensalidades',
 ARRAY['nome','qtd_parcelas','valor_total','dias_atraso']),

('evento_lembrete_hoje',
 'Lembrete de Evento — Hoje',
 'Envio no dia do evento.',
 E'Olá {{nome}},\n\nLembrete: *hoje* temos *{{evento}}* às *{{horario}}*{{#local}} em {{local}}{{/local}}.\n\nNos vemos lá!',
 'eventos',
 ARRAY['nome','evento','horario','local']),

('evento_lembrete_amanha',
 'Lembrete de Evento — Amanhã',
 'Envio um dia antes do evento.',
 E'Olá {{nome}},\n\nLembrete: *amanhã* ({{data}}) temos *{{evento}}* às *{{horario}}*{{#local}} em {{local}}{{/local}}.\n\nConte com sua presença!',
 'eventos',
 ARRAY['nome','evento','data','horario','local']),

('evento_lembrete_semana',
 'Lembrete de Evento — Próxima Semana',
 'Envio com 2 a 7 dias de antecedência.',
 E'Olá {{nome}},\n\nLembrete: na próxima semana ({{data}}) teremos *{{evento}}* às *{{horario}}*{{#local}} em {{local}}{{/local}}.\n\nReserve a data!',
 'eventos',
 ARRAY['nome','evento','data','horario','local']);

-- =============================================
-- Entrada em system_screens
-- =============================================
INSERT INTO public.system_screens (nome, descricao, rota, icone, ordem, ativo) VALUES
('Notificações WhatsApp', 'Gestão de templates e log de envios via WhatsApp', '/admin/notificacoes-whatsapp', 'MessageCircle', 100, true);

INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r::app_role
FROM public.system_screens s
CROSS JOIN (VALUES ('admin'), ('comando')) AS t(r)
WHERE s.rota = '/admin/notificacoes-whatsapp';
