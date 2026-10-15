DO $$
DECLARE definicao text;
BEGIN
  SELECT pg_get_functiondef('public.pd_acao(uuid,text,jsonb)'::regprocedure) INTO definicao;
  IF position('regional_descricao = descricao,' in definicao) = 0 THEN
    RAISE EXCEPTION 'Trecho esperado da geração Regional não encontrado';
  END IF;
  definicao := replace(definicao, 'regional_descricao = descricao,', 'regional_descricao = COALESCE(NULLIF(trim(_dados->>''resumo''), ''''), descricao),');
  EXECUTE definicao;
END $$;