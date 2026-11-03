CREATE TABLE public.pesquisa_ciclos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), regional_id uuid NOT NULL REFERENCES public.regionais(id), nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120), inicio text NOT NULL CHECK (inicio ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), fim text NOT NULL CHECK (fim ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), fechado_em timestamptz NOT NULL DEFAULT now(), fechado_por text NOT NULL, CHECK (inicio <= fim));
GRANT ALL ON public.pesquisa_ciclos TO service_role;
ALTER TABLE public.pesquisa_ciclos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.pesquisa_ciclo_versoes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ciclo_id uuid NOT NULL REFERENCES public.pesquisa_ciclos(id), versao integer NOT NULL CHECK (versao > 0), criado_em timestamptz NOT NULL DEFAULT now(), criado_por text NOT NULL, motivo text, snapshot jsonb NOT NULL, pdf_base64 text NOT NULL, hash_base text NOT NULL, UNIQUE(ciclo_id,versao));
GRANT ALL ON public.pesquisa_ciclo_versoes TO service_role;
ALTER TABLE public.pesquisa_ciclo_versoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX pesquisa_ciclos_regional_periodo ON public.pesquisa_ciclos(regional_id,inicio,fim);
CREATE OR REPLACE FUNCTION public.pesquisa_preservar_fechamento() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Fechamentos são imutáveis; crie uma revisão.'; END $$;
CREATE TRIGGER pesquisa_ciclos_imutaveis BEFORE UPDATE OR DELETE ON public.pesquisa_ciclos FOR EACH ROW EXECUTE FUNCTION public.pesquisa_preservar_fechamento();
CREATE TRIGGER pesquisa_versoes_imutaveis BEFORE UPDATE OR DELETE ON public.pesquisa_ciclo_versoes FOR EACH ROW EXECUTE FUNCTION public.pesquisa_preservar_fechamento();
CREATE OR REPLACE FUNCTION public.pesquisa_registrar_ciclo(_regional uuid,_nome text,_inicio text,_fim text,_autor text,_snapshot jsonb,_pdf text,_hash text,_revisar uuid DEFAULT NULL,_motivo text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; v integer; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(_regional::text,0));
IF _revisar IS NULL THEN
IF EXISTS(SELECT 1 FROM public.pesquisa_ciclos WHERE regional_id=_regional AND inicio<=_fim AND fim>=_inicio) THEN RAISE EXCEPTION 'O período se sobrepõe a um ciclo oficial existente.'; END IF;
INSERT INTO public.pesquisa_ciclos(regional_id,nome,inicio,fim,fechado_por) VALUES(_regional,_nome,_inicio,_fim,_autor) RETURNING id INTO cid; v:=1;
ELSE
SELECT id INTO cid FROM public.pesquisa_ciclos WHERE id=_revisar AND regional_id=_regional AND inicio=_inicio AND fim=_fim;
IF cid IS NULL OR length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Revisão inválida: informe o motivo e mantenha o período original.'; END IF;
SELECT coalesce(max(versao),0)+1 INTO v FROM public.pesquisa_ciclo_versoes WHERE ciclo_id=cid;
END IF;
INSERT INTO public.pesquisa_ciclo_versoes(ciclo_id,versao,criado_por,motivo,snapshot,pdf_base64,hash_base) VALUES(cid,v,_autor,_motivo,_snapshot,_pdf,_hash);
RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.pesquisa_registrar_ciclo(uuid,text,text,text,text,jsonb,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisa_registrar_ciclo(uuid,text,text,text,text,jsonb,text,text,uuid,text) TO service_role;