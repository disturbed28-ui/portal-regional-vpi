
CREATE TABLE IF NOT EXISTS public.links_uteis_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icone TEXT NOT NULL DEFAULT 'Link',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.links_uteis_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados podem ver grupos" ON public.links_uteis_grupos;
CREATE POLICY "Todos autenticados podem ver grupos"
  ON public.links_uteis_grupos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Apenas admins podem gerenciar grupos" ON public.links_uteis_grupos;
CREATE POLICY "Apenas admins podem gerenciar grupos"
  ON public.links_uteis_grupos FOR ALL
  TO authenticated
  USING (has_role((auth.uid())::text, 'admin'::app_role))
  WITH CHECK (has_role((auth.uid())::text, 'admin'::app_role));

DROP TRIGGER IF EXISTS update_links_uteis_grupos_updated_at ON public.links_uteis_grupos;
CREATE TRIGGER update_links_uteis_grupos_updated_at
  BEFORE UPDATE ON public.links_uteis_grupos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.links_uteis_grupos (nome, slug, icone, ordem)
  VALUES ('Geral', 'geral', 'Link', 0)
  ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.links_uteis
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.links_uteis_grupos(id);

UPDATE public.links_uteis
  SET grupo_id = (SELECT id FROM public.links_uteis_grupos WHERE slug = 'geral')
  WHERE grupo_id IS NULL;

ALTER TABLE public.links_uteis
  ALTER COLUMN grupo_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.bloquear_delete_grupo_com_links()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.links_uteis WHERE grupo_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir um grupo que contém links. Remova ou mova os links antes.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_delete_grupo_com_links ON public.links_uteis_grupos;
CREATE TRIGGER trg_bloquear_delete_grupo_com_links
  BEFORE DELETE ON public.links_uteis_grupos
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_grupo_com_links();

-- Sincronizar grupos com system_screens (matriz de permissões usa system_screens.rota)
CREATE OR REPLACE FUNCTION public.sync_links_uteis_grupo_system_screens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rota TEXT;
  v_old_rota TEXT;
  v_nome TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_rota := '/links-uteis/' || NEW.slug;
    v_nome := 'Links Úteis - ' || NEW.nome;
    INSERT INTO public.system_screens (rota, nome, descricao, icone, ativo)
    VALUES (v_rota, v_nome, 'Grupo de links úteis: ' || NEW.nome, NEW.icone, true)
    ON CONFLICT (rota) DO UPDATE
      SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone, ativo = true;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_rota := '/links-uteis/' || NEW.slug;
    v_old_rota := '/links-uteis/' || OLD.slug;
    v_nome := 'Links Úteis - ' || NEW.nome;
    UPDATE public.system_screens
      SET rota = v_rota, nome = v_nome,
          descricao = 'Grupo de links úteis: ' || NEW.nome,
          icone = NEW.icone, ativo = NEW.ativo
      WHERE rota = v_old_rota;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_rota := '/links-uteis/' || OLD.slug;
    DELETE FROM public.system_screens WHERE rota = v_old_rota;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_links_uteis_grupo_system_screens ON public.links_uteis_grupos;
CREATE TRIGGER trg_sync_links_uteis_grupo_system_screens
  AFTER INSERT OR UPDATE OR DELETE ON public.links_uteis_grupos
  FOR EACH ROW EXECUTE FUNCTION public.sync_links_uteis_grupo_system_screens();

-- Garantir entrada para "Geral"
INSERT INTO public.system_screens (rota, nome, descricao, icone, ativo)
VALUES ('/links-uteis/geral', 'Links Úteis - Geral', 'Grupo de links úteis: Geral', 'Link', true)
ON CONFLICT (rota) DO NOTHING;
