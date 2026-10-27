CREATE TABLE public.pesquisa_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  regional_id uuid NOT NULL,
  divisao_id uuid,
  periodo_inicio text NOT NULL,
  periodo_fim text NOT NULL,
  hash_dados text,
  hash_processando text,
  n_respostas integer NOT NULL DEFAULT 0,
  resultado jsonb,
  erro text,
  lease_ate timestamptz,
  gerado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pesquisa_analises TO service_role;
ALTER TABLE public.pesquisa_analises ENABLE ROW LEVEL SECURITY;
-- Sem políticas: somente a função de relatório (servidor) lê e grava, após validar o escopo do usuário.

INSERT INTO public.system_settings (chave, valor, valor_texto, descricao)
VALUES ('pesquisa_min_respostas_qualitativo', true, '5', 'Mínimo de respostas distintas por divisão/período para exibir análise por IA e comentários da Pesquisa de Satisfação')
ON CONFLICT DO NOTHING;

WITH s AS (
  INSERT INTO public.system_screens (nome, descricao, rota, ordem, ativo)
  VALUES ('Aba Pesquisa de Satisfação', 'Relatório da Pesquisa de Satisfação dentro de Relatórios', '/relatorios/pesquisa-satisfacao', 0, true)
  RETURNING id
)
INSERT INTO public.screen_permissions (screen_id, role)
SELECT s.id, r::app_role FROM s, unnest(ARRAY['admin','comando','regional','diretor_regional','diretor_divisao','adm_regional']) r;