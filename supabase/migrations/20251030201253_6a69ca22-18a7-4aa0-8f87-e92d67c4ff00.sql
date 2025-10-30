-- Adicionar novas colunas à tabela integrantes_portal
ALTER TABLE public.integrantes_portal
ADD COLUMN cargo_estagio text,
ADD COLUMN sgt_armas boolean DEFAULT false,
ADD COLUMN caveira boolean DEFAULT false,
ADD COLUMN caveira_suplente boolean DEFAULT false,
ADD COLUMN batedor boolean DEFAULT false,
ADD COLUMN ursinho boolean DEFAULT false,
ADD COLUMN lobo boolean DEFAULT false,
ADD COLUMN tem_moto boolean DEFAULT false,
ADD COLUMN tem_carro boolean DEFAULT false,
ADD COLUMN data_entrada date;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.integrantes_portal.cargo_estagio IS 'Cargo que o integrante está estagiando';
COMMENT ON COLUMN public.integrantes_portal.sgt_armas IS 'Sargento de Armas';
COMMENT ON COLUMN public.integrantes_portal.caveira IS 'Possui Caveira';
COMMENT ON COLUMN public.integrantes_portal.caveira_suplente IS 'Caveira Suplente';
COMMENT ON COLUMN public.integrantes_portal.batedor IS 'É Batedor';
COMMENT ON COLUMN public.integrantes_portal.ursinho IS 'Possui Ursinho';
COMMENT ON COLUMN public.integrantes_portal.lobo IS 'Possui Lobo';
COMMENT ON COLUMN public.integrantes_portal.tem_moto IS 'Possui Moto';
COMMENT ON COLUMN public.integrantes_portal.tem_carro IS 'Possui Carro';
COMMENT ON COLUMN public.integrantes_portal.data_entrada IS 'Data de entrada no motoclube';