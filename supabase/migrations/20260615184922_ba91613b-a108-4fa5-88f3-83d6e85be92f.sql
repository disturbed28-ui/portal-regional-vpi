UPDATE public.notificacoes_whatsapp_templates
SET corpo = 'Olá, informo que o candidato {{candidato_colete}} ({{candidato_nome}}) consta como DESISTENTE.
Regional: {{regional}}
Divisão: {{divisao}}
Diretor Regional: {{diretor_regional}}
Data do último contato: {{data_contato}}
Observação: {{observacao}}'
WHERE chave = 'expansao_desistente';