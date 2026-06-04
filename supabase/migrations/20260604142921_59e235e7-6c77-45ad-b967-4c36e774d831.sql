-- Enum de status do candidato de expansão
DO $$ BEGIN
  CREATE TYPE public.expansao_status AS ENUM (
    'pendente',
    'enviado',
    'efetivado',
    'efetivado_reportado',
    'desistente',
    'desistente_reportado',
    'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de candidatos da Expansão
CREATE TABLE public.expansao_candidatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status public.expansao_status NOT NULL DEFAULT 'pendente',

  -- Bruto / IA
  ficha_raw TEXT,
  dados_extraidos JSONB,
  anexo_path TEXT,

  -- Dados da ficha
  nome_completo TEXT,
  nome_colete TEXT,
  telefone TEXT,
  cpf TEXT,
  rg TEXT,
  nascimento TEXT,
  profissao TEXT,
  email TEXT,
  endereco_rua TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  endereco_cep TEXT,
  tamanho_camiseta TEXT,
  colete_tipo TEXT,
  tamanho_colete TEXT,
  forma_pagamento TEXT,
  contato_emergencia TEXT,
  comando_responsavel TEXT,
  diretor_regional_responsavel TEXT,

  -- Representante da Expansão (origem da ficha)
  expansao_nome TEXT,
  expansao_telefone TEXT,
  data_recebimento DATE,

  -- Hierarquia
  regional_id UUID REFERENCES public.regionais(id),
  divisao_id UUID REFERENCES public.divisoes(id),

  -- Trilha de auditoria
  cadastrado_por TEXT,
  cadastrado_por_nome TEXT,
  enviado_em TIMESTAMPTZ,
  enviado_por TEXT,
  baixa_em TIMESTAMPTZ,
  baixa_por TEXT,
  baixa_observacao TEXT,
  reportado_em TIMESTAMPTZ,
  reportado_por TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expansao_candidatos TO authenticated;
GRANT ALL ON public.expansao_candidatos TO service_role;

ALTER TABLE public.expansao_candidatos ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/comando veem tudo; demais veem por regional ou divisão
CREATE POLICY "expansao_select"
ON public.expansao_candidatos
FOR SELECT
TO authenticated
USING (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
  OR regional_id IN (SELECT p.regional_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
  OR divisao_id IN (SELECT p.divisao_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
);

-- INSERT: admin/comando ou diretor regional, na própria regional
CREATE POLICY "expansao_insert"
ON public.expansao_candidatos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
  OR (
    public.has_role((auth.uid())::text, 'diretor_regional'::app_role)
    AND regional_id IN (SELECT p.regional_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
  )
);

-- UPDATE: admin/comando; DR na própria regional; DD na própria divisão
CREATE POLICY "expansao_update"
ON public.expansao_candidatos
FOR UPDATE
TO authenticated
USING (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
  OR regional_id IN (SELECT p.regional_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
  OR divisao_id IN (SELECT p.divisao_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
)
WITH CHECK (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
  OR regional_id IN (SELECT p.regional_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
  OR divisao_id IN (SELECT p.divisao_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
);

-- DELETE: admin/comando ou DR na própria regional
CREATE POLICY "expansao_delete"
ON public.expansao_candidatos
FOR DELETE
TO authenticated
USING (
  public.has_role((auth.uid())::text, 'admin'::app_role)
  OR public.has_role((auth.uid())::text, 'comando'::app_role)
  OR (
    public.has_role((auth.uid())::text, 'diretor_regional'::app_role)
    AND regional_id IN (SELECT p.regional_id FROM public.profiles p WHERE p.id = (auth.uid())::text)
  )
);

-- Trigger updated_at
CREATE TRIGGER trg_expansao_updated_at
BEFORE UPDATE ON public.expansao_candidatos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para resolver regional_id a partir da divisão quando aplicável
CREATE OR REPLACE FUNCTION public.fn_expansao_set_regional()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.divisao_id IS NOT NULL AND NEW.regional_id IS NULL THEN
    SELECT d.regional_id INTO NEW.regional_id
    FROM public.divisoes d WHERE d.id = NEW.divisao_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_expansao_set_regional
BEFORE INSERT OR UPDATE ON public.expansao_candidatos
FOR EACH ROW EXECUTE FUNCTION public.fn_expansao_set_regional();

-- Registrar tela no sistema de permissões
INSERT INTO public.system_screens (rota, nome, descricao, icone, ativo)
VALUES ('/expansao', 'Expansão', 'Cadastro e acompanhamento de candidatos da Expansão', 'UserPlus', true)
ON CONFLICT (rota) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, ativo = true;

-- Acesso inicial para Diretor Regional (Grau V)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, 'diretor_regional'::app_role
FROM public.system_screens s WHERE s.rota = '/expansao'
ON CONFLICT DO NOTHING;

-- Templates de WhatsApp configuráveis para Expansão
INSERT INTO public.notificacoes_whatsapp_templates (chave, titulo, corpo, ativo)
VALUES
  ('expansao_efetivado', 'Expansão - Candidato Efetivado',
   'Olá {{candidato_nome}} foi EFETIVADO!%0A%0ANome de colete: {{candidato_colete}}%0ARegional: {{regional}}%0ADivisão: {{divisao}}%0ADiretor Regional: {{diretor_regional}}%0AStatus: {{status}}', true),
  ('expansao_desistente', 'Expansão - Candidato Desistente',
   'Olá, informo que o candidato {{candidato_colete}} ({{candidato_nome}}) consta como DESISTENTE.%0ARegional: {{regional}}%0ADivisão: {{divisao}}%0ADiretor Regional: {{diretor_regional}}', true)
ON CONFLICT (chave) DO NOTHING;