-- ============================================================================
-- FASE 2: DATABASE - RBAC MÍNIMO + ALERTAS INADIMPLÊNCIA
-- ============================================================================
-- Implementação seguindo estratégia de ZERO IMPACTO nos artefatos existentes
-- (has_role, useUserRole, RLS policies existentes permanecem inalterados)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSION: UNACCENT (para normalização de textos)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ----------------------------------------------------------------------------
-- 2. FUNÇÃO: cargo_normalize(texto) - Normalização de cargos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cargo_normalize(cargo_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF cargo_texto IS NULL OR TRIM(cargo_texto) = '' THEN
    RETURN '';
  END IF;
  
  RETURN LOWER(TRIM(REGEXP_REPLACE(
    UNACCENT(cargo_texto),
    '[^a-zA-Z0-9 ]',
    '',
    'g'
  )));
END;
$$;

COMMENT ON FUNCTION public.cargo_normalize(TEXT) IS 
'Normaliza strings de cargos removendo acentos, pontuação e convertendo para lowercase. Exemplo: "Diretor de Divisão (Grau VI)" -> "diretor de divisao grau vi"';

-- ----------------------------------------------------------------------------
-- 3. TABELA: cargo_role_mapping - Mapeia cargos para roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cargo_role_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_nome TEXT NOT NULL UNIQUE,
  cargo_nome_normalizado TEXT NOT NULL,
  app_role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscas por cargo normalizado
CREATE INDEX IF NOT EXISTS idx_cargo_role_mapping_normalizado 
ON public.cargo_role_mapping(cargo_nome_normalizado);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_cargo_role_mapping_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cargo_role_mapping_updated_at
BEFORE UPDATE ON public.cargo_role_mapping
FOR EACH ROW
EXECUTE FUNCTION public.update_cargo_role_mapping_updated_at();

-- RLS: Todos podem ler, apenas admins podem modificar
ALTER TABLE public.cargo_role_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler cargo_role_mapping"
ON public.cargo_role_mapping
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins podem modificar cargo_role_mapping"
ON public.cargo_role_mapping
FOR ALL
TO authenticated
USING (has_role(auth.uid()::text, 'admin'))
WITH CHECK (has_role(auth.uid()::text, 'admin'));

COMMENT ON TABLE public.cargo_role_mapping IS 
'Mapeia textos de cargos (ex: "Diretor de Divisão") para roles do enum app_role. Usado para derivar roles automaticamente do cargo do perfil.';

-- ----------------------------------------------------------------------------
-- 4. SEED: Cargos Grau VI -> diretor_divisao (Fase Mínima)
-- ----------------------------------------------------------------------------
INSERT INTO public.cargo_role_mapping (cargo_nome, cargo_nome_normalizado, app_role)
VALUES
  -- Diretores de Divisão (Grau VI)
  ('Diretor de Divisão', 'diretor de divisao', 'diretor_divisao'),
  ('Diretor de Divisão (Grau VI)', 'diretor de divisao grau vi', 'diretor_divisao'),
  ('Diretor de Divisão Grau VI', 'diretor de divisao grau vi', 'diretor_divisao'),
  
  -- Subdiretores de Divisão (Grau VI)
  ('Subdiretor de Divisão', 'subdiretor de divisao', 'diretor_divisao'),
  ('Subdiretor de Divisão (Grau VI)', 'subdiretor de divisao grau vi', 'diretor_divisao'),
  ('Subdiretor de Divisão Grau VI', 'subdiretor de divisao grau vi', 'diretor_divisao'),
  
  -- Social de Divisão (Grau VI)
  ('Social de Divisão', 'social de divisao', 'diretor_divisao'),
  ('Social de Divisão (Grau VI)', 'social de divisao grau vi', 'diretor_divisao'),
  ('Social de Divisão Grau VI', 'social de divisao grau vi', 'diretor_divisao'),
  
  -- Administrativo de Divisão (Grau VI)
  ('Adm. Divisão', 'adm divisao', 'diretor_divisao'),
  ('Adm. Divisão (Grau VI)', 'adm divisao grau vi', 'diretor_divisao'),
  ('Adm. Divisão Grau VI', 'adm divisao grau vi', 'diretor_divisao'),
  ('Administrativo de Divisão', 'administrativo de divisao', 'diretor_divisao'),
  ('Administrativo de Divisão (Grau VI)', 'administrativo de divisao grau vi', 'diretor_divisao'),
  
  -- Sargento de Armas de Divisão (Grau VI)
  ('Sgt.Armas Divisão', 'sgtarmas divisao', 'diretor_divisao'),
  ('Sgt.Armas Divisão (Grau VI)', 'sgtarmas divisao grau vi', 'diretor_divisao'),
  ('Sgt.Armas Divisão Grau VI', 'sgtarmas divisao grau vi', 'diretor_divisao'),
  ('Sargento de Armas Divisão', 'sargento de armas divisao', 'diretor_divisao'),
  ('Sargento de Armas Divisão (Grau VI)', 'sargento de armas divisao grau vi', 'diretor_divisao')
ON CONFLICT (cargo_nome) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. VIEW: v_user_effective_roles - Roles efetivas (diretas + derivadas)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_user_effective_roles AS
SELECT DISTINCT
  p.id AS user_id,
  COALESCE(ur.role, crm.app_role) AS effective_role,
  CASE
    WHEN ur.role IS NOT NULL THEN 'direct'
    ELSE 'cargo_derived'
  END AS role_source
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.cargo_role_mapping crm ON (
  -- Tentar match com cargo
  public.cargo_normalize(p.cargo) = crm.cargo_nome_normalizado
  OR
  -- Tentar match com cargo + grau
  public.cargo_normalize(p.cargo || ' ' || COALESCE(p.grau, '')) = crm.cargo_nome_normalizado
  OR
  -- Tentar match com cargo + grau formatado com parênteses
  public.cargo_normalize(p.cargo || ' (' || COALESCE(p.grau, '') || ')') = crm.cargo_nome_normalizado
)
WHERE ur.role IS NOT NULL OR crm.app_role IS NOT NULL;

COMMENT ON VIEW public.v_user_effective_roles IS 
'Consolida roles diretas (user_roles) e roles derivadas de cargos (cargo_role_mapping). Usa cargo_normalize() para matching robusto.';

-- ----------------------------------------------------------------------------
-- 6. FUNÇÃO: has_permission() - Verificação de permissões granulares
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id TEXT,
  _permission_code TEXT,
  _divisao_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_divisao_id UUID;
  _effective_roles app_role[];
BEGIN
  -- Validar entrada
  IF _user_id IS NULL OR _permission_code IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Buscar divisão do usuário
  SELECT divisao_id INTO _user_divisao_id
  FROM profiles
  WHERE id = _user_id;

  -- Buscar todas as roles efetivas (diretas + derivadas de cargo)
  SELECT ARRAY_AGG(DISTINCT effective_role) INTO _effective_roles
  FROM v_user_effective_roles
  WHERE user_id = _user_id;

  -- Se não tem roles, negar
  IF _effective_roles IS NULL OR array_length(_effective_roles, 1) = 0 THEN
    RETURN FALSE;
  END IF;

  -- Admin sempre tem permissão
  IF 'admin' = ANY(_effective_roles) THEN
    RETURN TRUE;
  END IF;

  -- Lógica de permissões por código
  CASE _permission_code
    -- ========================================================================
    -- ALERTAS DE INADIMPLÊNCIA
    -- ========================================================================
    
    -- Permissão para ENVIAR alertas na própria divisão
    WHEN 'ALERTAS_INADIMPLENCIA:SEND:OWN_DIVISION' THEN
      RETURN (
        'diretor_divisao' = ANY(_effective_roles) 
        AND (_divisao_id IS NULL OR _user_divisao_id = _divisao_id)
      );
    
    -- Permissão para VISUALIZAR alertas na própria divisão
    WHEN 'ALERTAS_INADIMPLENCIA:VIEW:OWN_DIVISION' THEN
      RETURN (
        ('diretor_divisao' = ANY(_effective_roles) OR 'regional' = ANY(_effective_roles))
        AND (_divisao_id IS NULL OR _user_divisao_id = _divisao_id)
      );
    
    -- ========================================================================
    -- FUTURAS PERMISSÕES (Fase 2+)
    -- ========================================================================
    -- Adicionar novos CASE WHEN aqui conforme necessário
    
    ELSE
      -- Permissão desconhecida: negar por segurança
      RETURN FALSE;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.has_permission(TEXT, TEXT, UUID) IS 
'Verifica permissões granulares baseadas em roles efetivas (diretas + cargo). NÃO substitui has_role(). Códigos suportados: ALERTAS_INADIMPLENCIA:SEND:OWN_DIVISION, ALERTAS_INADIMPLENCIA:VIEW:OWN_DIVISION';

-- ----------------------------------------------------------------------------
-- 7. TABELA: alertas_emails_log - Log de alertas enviados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alertas_emails_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificador do batch de envio
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Tipo de alerta
  tipo_alerta TEXT NOT NULL DEFAULT 'INADIMPLENCIA_70_DIAS',
  
  -- Dados do integrante inadimplente
  registro_id INTEGER NOT NULL,
  nome_colete TEXT NOT NULL,
  divisao_texto TEXT NOT NULL,
  dias_atraso INTEGER NOT NULL,
  valor_total NUMERIC NOT NULL,
  total_parcelas INTEGER NOT NULL,
  
  -- Destinatários do email
  email_destinatario TEXT NOT NULL, -- Diretor (To)
  destinatario_nome TEXT,
  destinatario_cargo TEXT,
  email_cc TEXT[], -- Admins (CC)
  
  -- Controle de envio
  status TEXT NOT NULL DEFAULT 'enviado', 
  -- Valores: 'enviado', 'erro', 'ignorado_cooldown', 'ignorado_pagamento', 'ignorado_acordo'
  motivo_ignorado TEXT,
  erro_mensagem TEXT,
  
  -- Metadata do email
  message_id TEXT, -- ID do email SMTP (para rastreamento)
  template_version TEXT DEFAULT 'v1',
  payload_hash TEXT, -- Hash MD5 do payload para dedupe
  
  -- Timestamps
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alertas_log_registro_enviado 
ON public.alertas_emails_log(registro_id, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_log_run_id 
ON public.alertas_emails_log(run_id);

CREATE INDEX IF NOT EXISTS idx_alertas_log_status 
ON public.alertas_emails_log(status);

CREATE INDEX IF NOT EXISTS idx_alertas_log_divisao 
ON public.alertas_emails_log(divisao_texto);

CREATE INDEX IF NOT EXISTS idx_alertas_log_tipo_enviado 
ON public.alertas_emails_log(tipo_alerta, enviado_em DESC);

-- RLS: Apenas admins podem ver logs completos
ALTER TABLE public.alertas_emails_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os logs de alertas"
ON public.alertas_emails_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid()::text, 'admin'));

CREATE POLICY "Diretores de divisão podem ver logs da própria divisão"
ON public.alertas_emails_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid()::text, 'diretor_divisao')
  AND divisao_texto IN (
    SELECT d.nome
    FROM profiles p
    JOIN divisoes d ON d.id = p.divisao_id
    WHERE p.id = auth.uid()::text
  )
);

CREATE POLICY "Sistema pode inserir logs"
ON public.alertas_emails_log
FOR INSERT
TO authenticated
WITH CHECK (true); -- Edge function com service role pode inserir

COMMENT ON TABLE public.alertas_emails_log IS 
'Log completo de alertas de inadimplência enviados. Inclui dedupe por payload_hash e cooldown tracking.';

-- ============================================================================
-- FIM DA MIGRAÇÃO - FASE 2 COMPLETA
-- ============================================================================