CREATE OR REPLACE FUNCTION public.pd_acao(_id uuid, _acao text, _dados jsonb DEFAULT '{}'::jsonb)
RETURNS public.processos_disciplinares
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pd public.processos_disciplinares;
  uid text := (auth.uid())::text;
  nome text;
  prox integer;
  ano_atual integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  descr text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO pd FROM public.processos_disciplinares WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PD não encontrado'; END IF;
  SELECT COALESCE(p.nome_colete, p.name) INTO nome FROM public.profiles p WHERE p.id = uid;

  IF _acao = 'emitir' THEN
    IF pd.autor_profile_id <> uid THEN RAISE EXCEPTION 'Só o autor pode emitir'; END IF;
    IF pd.status <> 'rascunho' THEN RAISE EXCEPTION 'PD já emitido'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('pd_numero_' || ano_atual));
    SELECT COALESCE(MAX(numero), 0) + 1 INTO prox FROM public.processos_disciplinares WHERE ano = ano_atual;
    UPDATE public.processos_disciplinares SET numero = prox, ano = ano_atual, status = 'emitido', emitido_em = now()
      WHERE id = _id RETURNING * INTO pd;
    descr := 'PD emitido e enviado ao Diretor Regional';
  ELSE
    IF pd.status = 'rascunho' THEN RAISE EXCEPTION 'PD ainda não emitido'; END IF;
    IF NOT public.pd_pode_tratar(pd.divisao_id, pd.regional_id) THEN RAISE EXCEPTION 'Sem permissão para tratar este PD'; END IF;
    IF pd.status IN ('concluido','cancelado') THEN RAISE EXCEPTION 'PD já encerrado'; END IF;

    IF _acao = 'abrir' THEN
      IF pd.status <> 'emitido' THEN RETURN pd; END IF;
      UPDATE public.processos_disciplinares SET status = 'em_analise' WHERE id = _id RETURNING * INTO pd;
      descr := 'Recebido pela Regional (em análise)';
    ELSIF _acao = 'gerar_versao' THEN
      IF pd.status NOT IN ('emitido','em_analise') THEN RAISE EXCEPTION 'Versão Regional já existe'; END IF;
      IF COALESCE(trim(_dados->>'resumo'), '') = '' THEN RAISE EXCEPTION 'Gere o resumo antes de criar a versão Regional'; END IF;
      UPDATE public.processos_disciplinares SET status = 'versao_regional',
        regional_titulo = titulo, regional_envolvidos = envolvidos, regional_local = local,
        regional_data_ocorrencia = data_ocorrencia, regional_hora_ocorrencia = hora_ocorrencia,
        regional_descricao = trim(_dados->>'resumo'), regional_houve_conciliacao = houve_conciliacao,
        regional_conciliacao_descricao = conciliacao_descricao,
        regional_autor_profile_id = uid, regional_autor_nome = nome, regional_atualizado_em = now()
        WHERE id = _id RETURNING * INTO pd;
      descr := 'Versão Regional criada';
    ELSIF _acao IN ('salvar_versao','encaminhar') THEN
      IF pd.status <> 'versao_regional' THEN RAISE EXCEPTION 'Versão Regional não está em elaboração'; END IF;
      UPDATE public.processos_disciplinares SET
        regional_titulo = COALESCE(_dados->>'titulo', regional_titulo),
        regional_envolvidos = COALESCE(_dados->'envolvidos', regional_envolvidos),
        regional_local = COALESCE(_dados->>'local', regional_local),
        regional_data_ocorrencia = COALESCE((_dados->>'data_ocorrencia')::date, regional_data_ocorrencia),
        regional_hora_ocorrencia = COALESCE(_dados->>'hora_ocorrencia', regional_hora_ocorrencia),
        regional_descricao = COALESCE(_dados->>'descricao', regional_descricao),
        regional_houve_conciliacao = COALESCE((_dados->>'houve_conciliacao')::boolean, regional_houve_conciliacao),
        regional_conciliacao_descricao = CASE WHEN _dados ? 'conciliacao_descricao' THEN _dados->>'conciliacao_descricao' ELSE regional_conciliacao_descricao END,
        regional_parecer = CASE WHEN _dados ? 'parecer' THEN _dados->>'parecer' ELSE regional_parecer END,
        regional_autor_profile_id = uid, regional_autor_nome = nome, regional_atualizado_em = now(),
        status = CASE WHEN _acao = 'encaminhar' THEN 'aguardando_cmd' ELSE status END,
        encaminhado_em = CASE WHEN _acao = 'encaminhar' THEN now() ELSE encaminhado_em END
        WHERE id = _id RETURNING * INTO pd;
      descr := CASE WHEN _acao = 'encaminhar' THEN 'Encaminhado ao CMD Regional' ELSE 'Versão Regional salva (rascunho)' END;
    ELSIF _acao = 'registrar_devolutiva' THEN
      IF pd.status <> 'aguardando_cmd' THEN RAISE EXCEPTION 'PD não está aguardando devolutiva'; END IF;
      IF COALESCE(trim(_dados->>'decisao'),'') = '' OR COALESCE(trim(_dados->>'acao'),'') = '' THEN
        RAISE EXCEPTION 'Informe a decisão e a ação a ser tomada'; END IF;
      UPDATE public.processos_disciplinares SET devolutiva_decisao = _dados->>'decisao', devolutiva_acao = _dados->>'acao',
        devolutiva_observacoes = NULLIF(trim(COALESCE(_dados->>'observacoes','')), ''), devolutiva_em = now()
        WHERE id = _id RETURNING * INTO pd;
      descr := 'Devolutiva do CMD Regional registrada';
    ELSIF _acao = 'concluir' THEN
      IF pd.status <> 'aguardando_cmd' OR pd.devolutiva_decisao IS NULL THEN RAISE EXCEPTION 'Registre a devolutiva antes de concluir'; END IF;
      UPDATE public.processos_disciplinares SET status = 'concluido', concluido_em = now() WHERE id = _id RETURNING * INTO pd;
      descr := 'PD concluído';
    ELSIF _acao = 'cancelar' THEN
      IF COALESCE(trim(_dados->>'justificativa'),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
      UPDATE public.processos_disciplinares SET status = 'cancelado', cancelado_em = now(), cancelado_por_profile_id = uid,
        cancelado_por_nome = nome, cancelamento_justificativa = trim(_dados->>'justificativa')
        WHERE id = _id RETURNING * INTO pd;
      descr := 'PD cancelado: ' || trim(_dados->>'justificativa');
    ELSE
      RAISE EXCEPTION 'Ação inválida';
    END IF;
  END IF;

  INSERT INTO public.processos_disciplinares_eventos(pd_id, acao, descricao, responsavel_profile_id, responsavel_nome)
  VALUES (_id, _acao, descr, uid, nome);
  RETURN pd;
END $$;

