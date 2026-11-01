CREATE TABLE public.avisos_deslocamento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), autor_profile_id text NOT NULL,
 integrante_id uuid REFERENCES public.integrantes_portal(id), nome_colete text NOT NULL, grau_texto text,
 divisao_id uuid REFERENCES public.divisoes(id), divisao_texto text,
 regional_id uuid REFERENCES public.regionais(id), regional_texto text,
 tipo_aviso text NOT NULL CHECK (tipo_aviso IN ('dentro_regional','entre_regionais')),
 cidade_origem text NOT NULL CHECK (length(trim(cidade_origem)) > 0), cidade_destino text NOT NULL CHECK (length(trim(cidade_destino)) > 0),
 meio_transporte text NOT NULL CHECK (meio_transporte IN ('moto','carro','outros')), meio_transporte_outro text,
 acompanhante_tipo text CHECK (acompanhante_tipo IN ('nenhum','esposa','filho','esposa_filho')),
 contato_regional boolean,
 destinatario_nome text, destinatario_cargo text, destinatario_telefone text, mensagem text,
 status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','cancelado')), cancelado_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT aviso_campos_entre_regionais CHECK (tipo_aviso <> 'entre_regionais' OR (acompanhante_tipo IS NOT NULL AND contato_regional IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos_deslocamento TO authenticated;
GRANT ALL ON public.avisos_deslocamento TO service_role;
ALTER TABLE public.avisos_deslocamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avisos visiveis" ON public.avisos_deslocamento FOR SELECT TO authenticated USING (autor_profile_id = auth.uid()::text OR public.protocolo_viagem_no_escopo(divisao_id, regional_id));
CREATE POLICY "Avisos criados pelo autor" ON public.avisos_deslocamento FOR INSERT TO authenticated WITH CHECK (autor_profile_id = auth.uid()::text);
CREATE POLICY "Avisos editados pelo autor" ON public.avisos_deslocamento FOR UPDATE TO authenticated USING (autor_profile_id = auth.uid()::text OR public.has_role(auth.uid()::text, 'admin') OR public.has_role(auth.uid()::text, 'comando')) WITH CHECK (autor_profile_id = auth.uid()::text OR public.has_role(auth.uid()::text, 'admin') OR public.has_role(auth.uid()::text, 'comando'));
CREATE POLICY "Avisos removidos pelo autor" ON public.avisos_deslocamento FOR DELETE TO authenticated USING (autor_profile_id = auth.uid()::text OR public.has_role(auth.uid()::text, 'admin') OR public.has_role(auth.uid()::text, 'comando'));
CREATE INDEX avisos_deslocamento_created_at_idx ON public.avisos_deslocamento(created_at DESC);
CREATE TRIGGER avisos_deslocamento_updated_at BEFORE UPDATE ON public.avisos_deslocamento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();