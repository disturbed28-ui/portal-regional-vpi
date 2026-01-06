-- Corrigir solicitações de estágio que não tiveram aprovações geradas
DO $$
DECLARE
  r RECORD;
  v_diretor_divisao RECORD;
  v_responsavel_regional RECORD;
  v_diretor_regional RECORD;
  v_cargo_responsavel_id UUID;
BEGIN
  -- Para cada solicitação sem aprovações
  FOR r IN 
    SELECT s.* 
    FROM solicitacoes_estagio s
    LEFT JOIN aprovacoes_estagio a ON a.solicitacao_id = s.id
    WHERE a.id IS NULL
  LOOP
    -- Buscar Diretor Regional
    SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
    INTO v_diretor_regional
    FROM integrantes_portal ip
    WHERE ip.regional_id = r.regional_id
      AND ip.ativo = true
      AND ip.cargo_grau_texto ILIKE '%Diretor Regional%'
    ORDER BY ip.nome_colete
    LIMIT 1;

    -- GRAU V: Apenas Diretor Regional
    IF r.grau_estagio = 'V' THEN
      INSERT INTO aprovacoes_estagio (
        solicitacao_id, nivel, tipo_aprovador, 
        aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo
      ) VALUES (
        r.id, 1, 'diretor_regional', 
        v_diretor_regional.id, v_diretor_regional.nome_colete, 
        v_diretor_regional.cargo_grau_texto
      );
      
    -- GRAU VI: 3 aprovadores
    ELSE
      -- Diretor da Divisão
      SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
      INTO v_diretor_divisao
      FROM integrantes_portal ip
      WHERE ip.divisao_id = r.divisao_id
        AND ip.ativo = true
        AND (ip.cargo_grau_texto ILIKE '%Diretor%Divisao%' 
             OR ip.cargo_grau_texto ILIKE '%Diretor%Divisão%')
        AND ip.cargo_grau_texto NOT ILIKE '%Sub%'
      ORDER BY ip.nome_colete
      LIMIT 1;
      
      -- Responsável Regional
      SELECT cargo_responsavel_id INTO v_cargo_responsavel_id
      FROM cargo_responsavel_regional_mapping
      WHERE cargo_treinamento_id = r.cargo_estagio_id;
      
      IF v_cargo_responsavel_id IS NOT NULL THEN
        SELECT ip.id, ip.nome_colete, ip.cargo_grau_texto
        INTO v_responsavel_regional
        FROM integrantes_portal ip
        JOIN cargos c ON c.id = v_cargo_responsavel_id
        WHERE ip.regional_id = r.regional_id
          AND ip.ativo = true
          AND ip.cargo_grau_texto ILIKE '%' || SPLIT_PART(c.nome, ' (', 1) || '%'
        ORDER BY ip.nome_colete
        LIMIT 1;
      END IF;
      
      -- Inserir 3 aprovações
      INSERT INTO aprovacoes_estagio (
        solicitacao_id, nivel, tipo_aprovador, 
        aprovador_integrante_id, aprovador_nome_colete, aprovador_cargo
      ) VALUES 
        (r.id, 1, 'diretor_divisao', 
         v_diretor_divisao.id, v_diretor_divisao.nome_colete, 
         v_diretor_divisao.cargo_grau_texto),
        (r.id, 2, 'responsavel_regional', 
         v_responsavel_regional.id, v_responsavel_regional.nome_colete, 
         v_responsavel_regional.cargo_grau_texto),
        (r.id, 3, 'diretor_regional', 
         v_diretor_regional.id, v_diretor_regional.nome_colete, 
         v_diretor_regional.cargo_grau_texto);
    END IF;
  END LOOP;
END $$;