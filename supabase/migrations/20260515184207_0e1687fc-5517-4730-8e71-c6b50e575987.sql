
-- Tabela de decisão final por etapa
CREATE TABLE public.avaliacoes_decisao_final (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL,
  integrante_id uuid NOT NULL,
  etapa text NOT NULL CHECK (etapa IN ('divisao','regional')),
  decisao text NOT NULL CHECK (decisao IN ('aprovado','reprovado')),
  justificativa text,
  nota_calculada numeric NOT NULL DEFAULT 0,
  decidido_por text NOT NULL,
  decidido_por_nome text,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, integrante_id, etapa)
);

CREATE INDEX idx_avaliacoes_decisao_final_periodo_integrante
  ON public.avaliacoes_decisao_final (periodo_id, integrante_id);

ALTER TABLE public.avaliacoes_decisao_final ENABLE ROW LEVEL SECURITY;

-- updated_at
CREATE TRIGGER trg_avaliacoes_decisao_final_updated_at
BEFORE UPDATE ON public.avaliacoes_decisao_final
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bloqueia mudanças se o período estiver encerrado
CREATE TRIGGER trg_decisao_bloquear_periodo_encerrado
BEFORE INSERT OR UPDATE ON public.avaliacoes_decisao_final
FOR EACH ROW EXECUTE FUNCTION public.bloquear_avaliacao_periodo_encerrado();

-- ============================================================
-- Função: derruba decisões quando alguém edita critérios
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resetar_decisoes_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_periodo_id uuid;
  v_integrante_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_periodo_id := OLD.periodo_id;
    v_integrante_id := OLD.integrante_id;
  ELSE
    v_periodo_id := NEW.periodo_id;
    v_integrante_id := NEW.integrante_id;
  END IF;

  DELETE FROM public.avaliacoes_decisao_final
  WHERE periodo_id = v_periodo_id
    AND integrante_id = v_integrante_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_avaliacoes_resetar_decisoes
AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes_integrantes
FOR EACH ROW EXECUTE FUNCTION public.fn_resetar_decisoes_avaliacao();

-- ============================================================
-- Helpers de escopo (diretor de divisão / diretor regional do integrante)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_diretor_divisao_do_integrante(_user_id text, _integrante_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.integrantes_portal ip
    JOIN public.profiles p ON p.id = _user_id
    WHERE ip.id = _integrante_id
      AND p.divisao_id = ip.divisao_id
      AND public.has_role(_user_id, 'diretor_divisao'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_diretor_regional_do_integrante(_user_id text, _integrante_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.integrantes_portal ip
    JOIN public.profiles p ON p.id = _user_id
    WHERE ip.id = _integrante_id
      AND p.regional_id = ip.regional_id
      AND public.has_role(_user_id, 'diretor_regional'::app_role)
  );
$$;

-- ============================================================
-- RLS Policies
-- ============================================================

-- SELECT: mesma lógica do escopo de avaliacoes_integrantes
CREATE POLICY "Ver decisoes do escopo"
ON public.avaliacoes_decisao_final
FOR SELECT
TO authenticated
USING (
  has_role((auth.uid())::text, 'admin'::app_role)
  OR user_grau_num((auth.uid())::text) <= 4
  OR EXISTS (
    SELECT 1
    FROM integrantes_portal ip, profiles p
    WHERE ip.id = avaliacoes_decisao_final.integrante_id
      AND p.id = (auth.uid())::text
      AND (
        (user_grau_num((auth.uid())::text) = 5 AND ip.regional_id = p.regional_id)
        OR (user_grau_num((auth.uid())::text) >= 6 AND ip.divisao_id = p.divisao_id)
      )
  )
);

-- INSERT etapa divisao: DD do integrante ou admin/comando
CREATE POLICY "DD pode inserir decisao divisao"
ON public.avaliacoes_decisao_final
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM avaliacao_periodos ap WHERE ap.id = periodo_id AND ap.status = 'aberto')
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR user_grau_num((auth.uid())::text) <= 4
    OR (
      etapa = 'divisao'
      AND public.is_diretor_divisao_do_integrante((auth.uid())::text, integrante_id)
    )
    OR (
      etapa = 'regional'
      AND public.is_diretor_regional_do_integrante((auth.uid())::text, integrante_id)
      AND EXISTS (
        SELECT 1 FROM avaliacoes_decisao_final d2
        WHERE d2.periodo_id = avaliacoes_decisao_final.periodo_id
          AND d2.integrante_id = avaliacoes_decisao_final.integrante_id
          AND d2.etapa = 'divisao'
      )
    )
  )
);

-- UPDATE: DD/DR pode reabrir/atualizar a sua etapa enquanto periodo aberto
CREATE POLICY "DD/DR pode atualizar decisao"
ON public.avaliacoes_decisao_final
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM avaliacao_periodos ap WHERE ap.id = periodo_id AND ap.status = 'aberto')
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR user_grau_num((auth.uid())::text) <= 4
    OR (etapa = 'divisao' AND public.is_diretor_divisao_do_integrante((auth.uid())::text, integrante_id))
    OR (etapa = 'regional' AND public.is_diretor_regional_do_integrante((auth.uid())::text, integrante_id))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM avaliacao_periodos ap WHERE ap.id = periodo_id AND ap.status = 'aberto')
  AND (
    has_role((auth.uid())::text, 'admin'::app_role)
    OR user_grau_num((auth.uid())::text) <= 4
    OR (etapa = 'divisao' AND public.is_diretor_divisao_do_integrante((auth.uid())::text, integrante_id))
    OR (etapa = 'regional' AND public.is_diretor_regional_do_integrante((auth.uid())::text, integrante_id))
  )
);

-- DELETE: somente admin
CREATE POLICY "Apenas admin pode deletar decisao"
ON public.avaliacoes_decisao_final
FOR DELETE
TO authenticated
USING (has_role((auth.uid())::text, 'admin'::app_role));
