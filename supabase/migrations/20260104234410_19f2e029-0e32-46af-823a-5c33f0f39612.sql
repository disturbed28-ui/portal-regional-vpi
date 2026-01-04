-- =============================================
-- 1. Tabela: aprovacoes_treinamento
-- =============================================
CREATE TABLE public.aprovacoes_treinamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_treinamento(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 3),
  tipo_aprovador TEXT NOT NULL CHECK (tipo_aprovador IN ('diretor_divisao', 'responsavel_regional', 'diretor_regional')),
  aprovador_integrante_id UUID REFERENCES public.integrantes_portal(id),
  aprovador_nome_colete TEXT,
  aprovador_cargo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'reprovado')),
  data_hora_acao TIMESTAMPTZ,
  justificativa_rejeicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(solicitacao_id, nivel)
);

-- Índices para performance
CREATE INDEX idx_aprovacoes_solicitacao ON public.aprovacoes_treinamento(solicitacao_id);
CREATE INDEX idx_aprovacoes_aprovador ON public.aprovacoes_treinamento(aprovador_integrante_id);
CREATE INDEX idx_aprovacoes_status ON public.aprovacoes_treinamento(status);

-- Trigger para updated_at
CREATE TRIGGER update_aprovacoes_treinamento_updated_at
BEFORE UPDATE ON public.aprovacoes_treinamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Tabela: cargo_responsavel_regional_mapping
-- =============================================
CREATE TABLE public.cargo_responsavel_regional_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_treinamento_id UUID NOT NULL REFERENCES public.cargos(id),
  cargo_responsavel_id UUID NOT NULL REFERENCES public.cargos(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(cargo_treinamento_id)
);

-- Popular o mapeamento de cargos
INSERT INTO public.cargo_responsavel_regional_mapping (cargo_treinamento_id, cargo_responsavel_id)
SELECT 
  ct.id as cargo_treinamento_id,
  cr.id as cargo_responsavel_id
FROM public.cargos ct
CROSS JOIN public.cargos cr
WHERE 
  (ct.nome = 'Diretor Divisao (Grau VI)' AND cr.nome = 'Operacional Regional (Grau V)')
  OR (ct.nome = 'Sub Diretor Divisao (Grau VI)' AND cr.nome = 'Operacional Regional (Grau V)')
  OR (ct.nome = 'Adm. Divisao (Grau VI)' AND cr.nome = 'Adm. Regional (Grau V)')
  OR (ct.nome = 'Social Divisao (Grau VI)' AND cr.nome = 'Social Regional (Grau V)')
  OR (ct.nome = 'Sgt.Armas Divisao (Grau VI)' AND cr.nome = 'Operacional Regional (Grau V)');

-- =============================================
-- 3. RLS para aprovacoes_treinamento
-- =============================================
ALTER TABLE public.aprovacoes_treinamento ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver aprovações da sua regional
CREATE POLICY "Usuarios podem ver aprovacoes da sua regional"
ON public.aprovacoes_treinamento FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_treinamento st
    JOIN public.profiles p ON p.regional_id = st.regional_id
    WHERE st.id = solicitacao_id
    AND p.id = auth.uid()::text
  )
);

-- Aprovador pode atualizar sua aprovação
CREATE POLICY "Aprovador pode atualizar sua aprovacao"
ON public.aprovacoes_treinamento FOR UPDATE
TO authenticated
USING (
  aprovador_integrante_id IN (
    SELECT id FROM public.integrantes_portal WHERE profile_id = auth.uid()::text
  )
)
WITH CHECK (
  aprovador_integrante_id IN (
    SELECT id FROM public.integrantes_portal WHERE profile_id = auth.uid()::text
  )
);

-- =============================================
-- 4. Função para criar aprovações automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION public.criar_aprovacoes_treinamento()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_divisao_id UUID;
  v_regional_id UUID;
  v_cargo_treinamento_id UUID;
  v_diretor_divisao RECORD;
  v_responsavel_regional RECORD;
  v_diretor_regional RECORD;
  v_cargo_responsavel_id UUID;
BEGIN
  v_divisao_id := NEW.divisao_id;
  v_regional_id := NEW.regional_id;
  v_cargo_treinamento_id := NEW.cargo_treinamento_id;
  
  -- 1. Buscar Diretor da Divisão do integrante (não pode ser Sub)
  SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
  INTO v_diretor_divisao
  FROM integrantes_portal ip
  WHERE ip.divisao_id = v_divisao_id
    AND ip.ativo = true
    AND ip.cargo_grau_texto ILIKE '%Diretor%Divisao%'
    AND ip.cargo_grau_texto NOT ILIKE '%Sub%'
  ORDER BY ip.nome_colete
  LIMIT 1;
  
  -- 2. Buscar cargo responsável regional baseado no mapeamento
  SELECT cargo_responsavel_id INTO v_cargo_responsavel_id
  FROM cargo_responsavel_regional_mapping
  WHERE cargo_treinamento_id = v_cargo_treinamento_id;
  
  -- 3. Buscar Responsável Regional da pasta
  IF v_cargo_responsavel_id IS NOT NULL THEN
    SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
    INTO v_responsavel_regional
    FROM integrantes_portal ip
    JOIN cargos c ON c.id = v_cargo_responsavel_id
    WHERE ip.regional_id = v_regional_id
      AND ip.ativo = true
      AND ip.cargo_grau_texto ILIKE '%' || SPLIT_PART(c.nome, ' (', 1) || '%'
    ORDER BY ip.nome_colete
    LIMIT 1;
  END IF;
  
  -- 4. Buscar Diretor Regional
  SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
  INTO v_diretor_regional
  FROM integrantes_portal ip
  WHERE ip.regional_id = v_regional_id
    AND ip.ativo = true
    AND ip.cargo_grau_texto ILIKE '%Diretor Regional%'
  ORDER BY ip.nome_colete
  LIMIT 1;
  
  -- Inserir as 3 aprovações
  INSERT INTO aprovacoes_treinamento (solicitacao_id, nivel, tipo_aprovador, aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo)
  VALUES 
    (NEW.id, 1, 'diretor_divisao', v_diretor_divisao.id, v_diretor_divisao.nome_colete, v_diretor_divisao.cargo_grau_texto),
    (NEW.id, 2, 'responsavel_regional', v_responsavel_regional.id, v_responsavel_regional.nome_colete, v_responsavel_regional.cargo_grau_texto),
    (NEW.id, 3, 'diretor_regional', v_diretor_regional.id, v_diretor_regional.nome_colete, v_diretor_regional.cargo_grau_texto);
  
  RETURN NEW;
END;
$$;

-- Trigger para criar aprovações após inserção de solicitação
CREATE TRIGGER trigger_criar_aprovacoes_treinamento
AFTER INSERT ON public.solicitacoes_treinamento
FOR EACH ROW
EXECUTE FUNCTION public.criar_aprovacoes_treinamento();

-- =============================================
-- 5. Adicionar coluna data_aprovacao na solicitacoes_treinamento
-- =============================================
ALTER TABLE public.solicitacoes_treinamento 
ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMPTZ;