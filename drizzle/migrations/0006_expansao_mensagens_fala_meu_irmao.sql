UPDATE notificacoes_whatsapp_templates SET corpo = 'Fala meu irmão {{expansao_nome}}, {{candidato_nome}} foi EFETIVADO!

Nome de colete: {{candidato_colete}}
Telefone: {{candidato_telefone}}
Regional: {{regional}}
Divisão: {{divisao}}
Diretor Regional: {{diretor_regional}}
Status: {{status}}' WHERE chave = 'expansao_efetivado';
UPDATE notificacoes_whatsapp_templates SET corpo = 'Fala meu irmão {{expansao_nome}}, informo que o candidato {{candidato_colete}} ({{candidato_nome}}) consta como DESISTENTE.
Regional: {{regional}}
Divisão: {{divisao}}
Diretor Regional: {{diretor_regional}}
Data do último contato: {{data_contato}}
Observação: {{observacao}}' WHERE chave = 'expansao_desistente';