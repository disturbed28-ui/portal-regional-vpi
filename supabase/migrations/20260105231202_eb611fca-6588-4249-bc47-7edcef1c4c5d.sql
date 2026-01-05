-- Tabela de aprovações de estágio
CREATE TABLE IF NOT EXISTS public.aprovacoes_estagio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES solicitacoes_estagio(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL,
  tipo_aprovador TEXT NOT NULL,
  aprovador_integrante_id UUID REFERENCES integrantes_portal(id),
  aprovador_nome_colete TEXT,
  aprovador_cargo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_hora_acao TIMESTAMP WITH TIME ZONE,
  justificativa_rejeicao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.aprovacoes_estagio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view aprovacoes_estagio" ON public.aprovacoes_estagio
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update aprovacoes_estagio" ON public.aprovacoes_estagio
  FOR UPDATE TO authenticated USING (true);

-- Trigger para criar aprovações automaticamente
CREATE OR REPLACE FUNCTION public.criar_aprovacoes_estagio()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_divisao_id UUID;
  v_regional_id UUID;
  v_cargo_estagio_id UUID;
  v_grau_estagio TEXT;
  v_diretor_divisao RECORD;
  v_responsavel_regional RECORD;
  v_diretor_regional RECORD;
  v_cargo_responsavel_id UUID;
BEGIN
  v_divisao_id := NEW.divisao_id;
  v_regional_id := NEW.regional_id;
  v_cargo_estagio_id := NEW.cargo_estagio_id;
  v_grau_estagio := NEW.grau_estagio;
  
  -- Buscar Diretor Regional (sempre necessário)
  SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
  INTO v_diretor_regional
  FROM integrantes_portal ip
  WHERE ip.regional_id = v_regional_id
    AND ip.ativo = true
    AND ip.cargo_grau_texto ILIKE '%Diretor Regional%'
  ORDER BY ip.nome_colete
  LIMIT 1;

  -- GRAU V: Apenas Diretor Regional (1 aprovador)
  IF v_grau_estagio = 'V' THEN
    INSERT INTO aprovacoes_estagio (
      solicitacao_id, nivel, tipo_aprovador, 
      aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo
    ) VALUES (
      NEW.id, 1, 'diretor_regional', 
      v_diretor_regional.id, v_diretor_regional.nome_colete, v_diretor_regional.cargo_grau_texto
    );
    
  -- GRAU VI: 3 aprovadores (idêntico ao Treinamento)
  ELSE
    -- 1. Buscar Diretor da Divisão
    SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
    INTO v_diretor_divisao
    FROM integrantes_portal ip
    WHERE ip.divisao_id = v_divisao_id
      AND ip.ativo = true
      AND (ip.cargo_grau_texto ILIKE '%Diretor%Divisao%' OR ip.cargo_grau_texto ILIKE '%Diretor%Divisão%')
      AND ip.cargo_grau_texto NOT ILIKE '%Sub%'
    ORDER BY ip.nome_colete
    LIMIT 1;
    
    -- 2. Buscar Responsável Regional (mapeamento por cargo)
    SELECT cargo_responsavel_id INTO v_cargo_responsavel_id
    FROM cargo_responsavel_regional_mapping
    WHERE cargo_treinamento_id = v_cargo_estagio_id;
    
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
    
    -- Inserir as 3 aprovações
    INSERT INTO aprovacoes_estagio (
      solicitacao_id, nivel, tipo_aprovador, 
      aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo
    ) VALUES 
      (NEW.id, 1, 'diretor_divisao', v_diretor_divisao.id, v_diretor_divisao.nome_colete, v_diretor_divisao.cargo_grau_texto),
      (NEW.id, 2, 'responsavel_regional', v_responsavel_regional.id, v_responsavel_regional.nome_colete, v_responsavel_regional.cargo_grau_texto),
      (NEW.id, 3, 'diretor_regional', v_diretor_regional.id, v_diretor_regional.nome_colete, v_diretor_regional.cargo_grau_texto);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trigger_criar_aprovacoes_estagio
AFTER INSERT ON public.solicitacoes_estagio
FOR EACH ROW
EXECUTE FUNCTION public.criar_aprovacoes_estagio();