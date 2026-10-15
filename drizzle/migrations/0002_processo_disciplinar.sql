CREATE TABLE public.processos_disciplinares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer,
  ano integer,
  status text NOT NULL DEFAULT 'rascunho',
  autor_profile_id text NOT NULL,
  autor_nome text,
  divisao_id uuid,
  divisao_texto text,
  regional_id uuid,
  regional_texto text,
  titulo text NOT NULL,
  envolvidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  local text NOT NULL,
  data_ocorrencia date NOT NULL,
  hora_ocorrencia text,
  descricao text NOT NULL,
  houve_conciliacao boolean NOT NULL DEFAULT false,
  conciliacao_descricao text,
  emitido_em timestamptz,
  regional_titulo text,
  regional_envolvidos jsonb,
  regional_local text,
  regional_data_ocorrencia date,
  regional_hora_ocorrencia text,
  regional_descricao text,
  regional_houve_conciliacao boolean,
  regional_conciliacao_descricao text,
  regional_parecer text,
  regional_autor_profile_id text,
  regional_autor_nome text,
  regional_atualizado_em timestamptz,
  encaminhado_em timestamptz,
  devolutiva_decisao text,
  devolutiva_acao text,
  devolutiva_observacoes text,
  devolutiva_em timestamptz,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  cancelado_por_nome text,
  cancelado_por_profile_id text,
  cancelamento_justificativa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pd_status_valido CHECK (status IN ('rascunho','emitido','em_analise','versao_regional','aguardando_cmd','concluido','cancelado')),
  CONSTRAINT pd_numero_unico UNIQUE (ano, numero)
);

CREATE TABLE public.processos_disciplinares_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pd_id uuid NOT NULL REFERENCES public.processos_disciplinares(id) ON DELETE CASCADE,
  acao text NOT NULL,
  descricao text,
  responsavel_profile_id text,
  responsavel_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_disciplinares TO authenticated;
GRANT ALL ON public.processos_disciplinares TO service_role;
GRANT SELECT ON public.processos_disciplinares_eventos TO authenticated;
GRANT ALL ON public.processos_disciplinares_eventos TO service_role;

ALTER TABLE public.processos_disciplinares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos_disciplinares_eventos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pd_pode_tratar(_divisao_id uuid, _regional_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role((auth.uid())::text, 'admin'::app_role)
      OR public.has_role((auth.uid())::text, 'comando'::app_role)
      OR (public.user_has_screen_permission((auth.uid())::text, '/formularios/processo-disciplinar/regional')
          AND public.protocolo_viagem_no_escopo(_divisao_id, _regional_id))
$$;

CREATE POLICY "PD visiveis" ON public.processos_disciplinares FOR SELECT TO authenticated
USING (autor_profile_id = (auth.uid())::text
  OR (status <> 'rascunho' AND public.protocolo_viagem_no_escopo(divisao_id, regional_id)));

CREATE POLICY "PD criado pelo autor" ON public.processos_disciplinares FOR INSERT TO authenticated
WITH CHECK (autor_profile_id = (auth.uid())::text AND status = 'rascunho' AND numero IS NULL
  AND (public.user_has_screen_permission((auth.uid())::text, '/formularios/processo-disciplinar')
       OR public.has_role((auth.uid())::text, 'admin'::app_role)
       OR public.has_role((auth.uid())::text, 'comando'::app_role)));

CREATE POLICY "PD rascunho editado pelo autor" ON public.processos_disciplinares FOR UPDATE TO authenticated
USING (autor_profile_id = (auth.uid())::text AND status = 'rascunho')
WITH CHECK (autor_profile_id = (auth.uid())::text AND status = 'rascunho' AND numero IS NULL);

CREATE POLICY "PD rascunho descartado pelo autor" ON public.processos_disciplinares FOR DELETE TO authenticated
USING (autor_profile_id = (auth.uid())::text AND status = 'rascunho');

CREATE POLICY "PD eventos visiveis" ON public.processos_disciplinares_eventos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.processos_disciplinares p WHERE p.id = pd_id
  AND (p.autor_profile_id = (auth.uid())::text
       OR (p.status <> 'rascunho' AND public.protocolo_viagem_no_escopo(p.divisao_id, p.regional_id)))));

CREATE TRIGGER trg_pd_updated BEFORE UPDATE ON public.processos_disciplinares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pd_log_criacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.processos_disciplinares_eventos(pd_id, acao, descricao, responsavel_profile_id, responsavel_nome)
  VALUES (NEW.id, 'criado', 'PD criado (rascunho)', NEW.autor_profile_id, NEW.autor_nome);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pd_log_criacao AFTER INSERT ON public.processos_disciplinares
FOR EACH ROW EXECUTE FUNCTION public.pd_log_criacao();

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
      UPDATE public.processos_disciplinares SET status = 'versao_regional',
        regional_titulo = titulo, regional_envolvidos = envolvidos, regional_local = local,
        regional_data_ocorrencia = data_ocorrencia, regional_hora_ocorrencia = hora_ocorrencia,
        regional_descricao = descricao, regional_houve_conciliacao = houve_conciliacao,
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

GRANT EXECUTE ON FUNCTION public.pd_acao(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pd_pode_tratar(uuid, uuid) TO authenticated;

CREATE INDEX idx_pd_status ON public.processos_disciplinares(status, created_at DESC);
CREATE INDEX idx_pd_eventos ON public.processos_disciplinares_eventos(pd_id, created_at);