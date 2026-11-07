ALTER TABLE public.protocolos_viagem ADD COLUMN observacoes text;
ALTER TABLE public.avisos_deslocamento ADD COLUMN observacoes text;
COMMENT ON COLUMN public.protocolos_viagem.observacoes IS 'Observações livres informadas pelo integrante no aviso de deslocamento';
COMMENT ON COLUMN public.avisos_deslocamento.observacoes IS 'Observações livres informadas pelo integrante no aviso de deslocamento';