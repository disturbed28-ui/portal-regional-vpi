-- Recriar view sem SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_estrutura_completa;

CREATE VIEW public.vw_estrutura_completa AS
SELECT 
  c.id as comando_id,
  c.nome as comando,
  r.id as regional_id,
  r.nome as regional,
  d.id as divisao_id,
  d.nome as divisao
FROM public.divisoes d
JOIN public.regionais r ON d.regional_id = r.id
JOIN public.comandos c ON r.comando_id = c.id;