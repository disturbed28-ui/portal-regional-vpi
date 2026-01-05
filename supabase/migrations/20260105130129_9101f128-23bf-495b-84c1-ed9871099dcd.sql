-- Corrigir a função do trigger para usar match mais flexível
CREATE OR REPLACE FUNCTION public.criar_aprovacoes_treinamento()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    AND (
      ip.cargo_grau_texto ILIKE '%Diretor%Divisao%'
      OR ip.cargo_grau_texto ILIKE '%Diretor%Divisão%'
    )
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
      AND (
        ip.cargo_grau_texto ILIKE '%' || SPLIT_PART(c.nome, ' (', 1) || '%'
        OR ip.cargo_grau_texto ILIKE '%' || REPLACE(SPLIT_PART(c.nome, ' (', 1), 'a', 'ã') || '%'
      )
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

-- Popular aprovações para solicitação existente que não tem aprovações
-- Primeiro verificar se já existem aprovações para esta solicitação
DO $$
DECLARE
  v_solicitacao_id UUID := '530c2467-fed1-4cfd-bf17-60b64b9dfb49';
  v_divisao_id UUID;
  v_regional_id UUID;
  v_cargo_treinamento_id UUID;
  v_count INTEGER;
BEGIN
  -- Verificar se já existem aprovações
  SELECT COUNT(*) INTO v_count FROM aprovacoes_treinamento WHERE solicitacao_id = v_solicitacao_id;
  
  IF v_count = 0 THEN
    -- Buscar dados da solicitação
    SELECT divisao_id, regional_id, cargo_treinamento_id 
    INTO v_divisao_id, v_regional_id, v_cargo_treinamento_id
    FROM solicitacoes_treinamento 
    WHERE id = v_solicitacao_id;
    
    -- Inserir Diretor da Divisão
    INSERT INTO aprovacoes_treinamento (solicitacao_id, nivel, tipo_aprovador, aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo)
    SELECT 
      v_solicitacao_id, 
      1, 
      'diretor_divisao',
      ip.id, ip.nome_colete, ip.cargo_grau_texto
    FROM integrantes_portal ip
    WHERE ip.divisao_id = v_divisao_id
      AND ip.ativo = true
      AND (ip.cargo_grau_texto ILIKE '%Diretor%Divisao%' OR ip.cargo_grau_texto ILIKE '%Diretor%Divisão%')
      AND ip.cargo_grau_texto NOT ILIKE '%Sub%'
    ORDER BY ip.nome_colete
    LIMIT 1;

    -- Inserir Responsável Regional (Operacional para Sub Diretor)
    INSERT INTO aprovacoes_treinamento (solicitacao_id, nivel, tipo_aprovador, aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo)
    SELECT 
      v_solicitacao_id, 
      2, 
      'responsavel_regional',
      ip.id, ip.nome_colete, ip.cargo_grau_texto
    FROM integrantes_portal ip
    WHERE ip.regional_id = v_regional_id
      AND ip.ativo = true
      AND ip.cargo_grau_texto ILIKE '%Operacional Regional%'
    ORDER BY ip.nome_colete
    LIMIT 1;

    -- Inserir Diretor Regional
    INSERT INTO aprovacoes_treinamento (solicitacao_id, nivel, tipo_aprovador, aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo)
    SELECT 
      v_solicitacao_id, 
      3, 
      'diretor_regional',
      ip.id, ip.nome_colete, ip.cargo_grau_texto
    FROM integrantes_portal ip
    WHERE ip.regional_id = v_regional_id
      AND ip.ativo = true
      AND ip.cargo_grau_texto ILIKE '%Diretor Regional%'
    ORDER BY ip.nome_colete
    LIMIT 1;
  END IF;
END $$;