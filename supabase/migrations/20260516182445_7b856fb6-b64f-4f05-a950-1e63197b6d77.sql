
-- 1) Função que arquiva evento + presenças e apaga das tabelas ativas
CREATE OR REPLACE FUNCTION public.auto_archive_evento_removido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_historico_id uuid;
  v_motivo text;
BEGIN
  -- Só age quando status mudou para 'removed' ou 'cancelled'
  IF NEW.status NOT IN ('removed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_motivo := CASE NEW.status
    WHEN 'removed' THEN 'Evento removido do Google Calendar (sincronização automática)'
    WHEN 'cancelled' THEN 'Evento cancelado no Google Calendar (sincronização automática)'
  END;

  -- Arquivar evento
  INSERT INTO public.eventos_agenda_historico (
    evento_original_id, evento_google_id, titulo, data_evento,
    regional_id, divisao_id, tipo_evento, tipo_evento_peso,
    status_original, evento_created_at, motivo_exclusao,
    excluido_em, excluido_por
  ) VALUES (
    NEW.id, NEW.evento_id, NEW.titulo, NEW.data_evento,
    NEW.regional_id, NEW.divisao_id, NEW.tipo_evento, NEW.tipo_evento_peso,
    NEW.status, NEW.created_at, v_motivo,
    now(), 'system:auto-sync'
  )
  RETURNING id INTO v_historico_id;

  -- Arquivar presenças deste evento
  INSERT INTO public.presencas_historico (
    evento_historico_id, presenca_original_id, integrante_id, profile_id,
    status, justificativa_ausencia, justificativa_tipo,
    confirmado_em, confirmado_por, visitante_nome, visitante_tipo
  )
  SELECT
    v_historico_id, p.id, p.integrante_id, p.profile_id,
    p.status, p.justificativa_ausencia, p.justificativa_tipo,
    p.confirmado_em, p.confirmado_por, p.visitante_nome, p.visitante_tipo
  FROM public.presencas p
  WHERE p.evento_agenda_id = NEW.id;

  -- Apagar presenças órfãs
  DELETE FROM public.presencas WHERE evento_agenda_id = NEW.id;

  -- Apagar evento da tabela ativa
  DELETE FROM public.eventos_agenda WHERE id = NEW.id;

  RETURN NULL; -- Linha foi deletada
END;
$$;

-- 2) Trigger AFTER UPDATE
DROP TRIGGER IF EXISTS trg_auto_archive_evento_removido ON public.eventos_agenda;
CREATE TRIGGER trg_auto_archive_evento_removido
AFTER UPDATE OF status ON public.eventos_agenda
FOR EACH ROW
WHEN (NEW.status IN ('removed', 'cancelled'))
EXECUTE FUNCTION public.auto_archive_evento_removido();

-- 3) Limpeza one-time: arquivar e remover eventos já marcados como removed/cancelled
DO $$
DECLARE
  ev RECORD;
  v_historico_id uuid;
  v_motivo text;
BEGIN
  FOR ev IN
    SELECT * FROM public.eventos_agenda WHERE status IN ('removed','cancelled')
  LOOP
    v_motivo := CASE ev.status
      WHEN 'removed' THEN 'Evento removido do Google Calendar (limpeza retroativa)'
      WHEN 'cancelled' THEN 'Evento cancelado no Google Calendar (limpeza retroativa)'
    END;

    INSERT INTO public.eventos_agenda_historico (
      evento_original_id, evento_google_id, titulo, data_evento,
      regional_id, divisao_id, tipo_evento, tipo_evento_peso,
      status_original, evento_created_at, motivo_exclusao,
      excluido_em, excluido_por
    ) VALUES (
      ev.id, ev.evento_id, ev.titulo, ev.data_evento,
      ev.regional_id, ev.divisao_id, ev.tipo_evento, ev.tipo_evento_peso,
      ev.status, ev.created_at, v_motivo,
      now(), 'system:cleanup-backfill'
    )
    RETURNING id INTO v_historico_id;

    INSERT INTO public.presencas_historico (
      evento_historico_id, presenca_original_id, integrante_id, profile_id,
      status, justificativa_ausencia, justificativa_tipo,
      confirmado_em, confirmado_por, visitante_nome, visitante_tipo
    )
    SELECT
      v_historico_id, p.id, p.integrante_id, p.profile_id,
      p.status, p.justificativa_ausencia, p.justificativa_tipo,
      p.confirmado_em, p.confirmado_por, p.visitante_nome, p.visitante_tipo
    FROM public.presencas p
    WHERE p.evento_agenda_id = ev.id;

    DELETE FROM public.presencas WHERE evento_agenda_id = ev.id;
    DELETE FROM public.eventos_agenda WHERE id = ev.id;
  END LOOP;
END $$;
