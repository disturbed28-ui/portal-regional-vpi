UPDATE public.notificacoes_whatsapp_templates
SET corpo = 'Olá {{nome}},

A *{{divisao}}* possui *{{qtd_devedores}}* integrante(s) com mensalidade em aberto, totalizando *R$ {{valor_total}}*.

Devedores:
{{lista_devedores}}

Por favor, alinhe a regularização com os integrantes.

Obrigado!',
    variaveis_disponiveis = ARRAY['nome','divisao','qtd_devedores','valor_total','lista_devedores']
WHERE chave = 'mensalidade_adm_divisao';