# Notas de Migracoes e Correcoes Manuais

Este arquivo documenta SQLs de correcao que devem ser executados manualmente no SQL Editor do Supabase.

---

## 2025-12-03 - Correcao de Registro Fantasma (Acoes Sociais)

### Problema Identificado

O registro de acao social com `id = 63cfdae9-0f25-4c91-a693-9e088b1edfbb` foi marcado como `google_form_status = 'enviado'` no banco de dados, porem NAO aparece na planilha oficial de respostas do Google Forms do clube.

### Causa Raiz

A Edge Function `acoes-sociais-enviar-form` utilizava `mode: 'no-cors'` no fetch, o que impedia a validacao do status HTTP da resposta. O codigo marcava o registro como "enviado" simplesmente por nao ter ocorrido erro de rede, mesmo que o Google Forms pudesse ter rejeitado a requisicao por outros motivos (campos invalidos, formulario alterado, etc.).

### Correcao Aplicada

1. **Edge Function corrigida** (`supabase/functions/acoes-sociais-enviar-form/index.ts`):
   - Removido `mode: 'no-cors'` do fetch
   - Adicionada validacao de status HTTP (2xx/3xx = sucesso)
   - Status 4xx/5xx ou erro de rede agora marcam `google_form_status = 'erro'`

2. **SQL para corrigir o registro fantasma** (executar manualmente):

```sql
-- Correcao do registro fantasma - Acao Social marcada como 'enviado' 
-- mas que NAO aparece na planilha oficial do Google Forms
-- 
-- Data: 2025-12-03
-- Motivo: Bug na Edge Function que nao validava resposta HTTP
-- Acao: Reverter status para 'erro' para permitir reenvio

UPDATE acoes_sociais_registros
SET 
  google_form_status = 'erro',
  google_form_enviado_em = NULL,
  google_form_enviado_por = NULL
WHERE id = '63cfdae9-0f25-4c91-a693-9e088b1edfbb';

-- Verificar resultado:
-- SELECT id, google_form_status, google_form_enviado_em 
-- FROM acoes_sociais_registros 
-- WHERE id = '63cfdae9-0f25-4c91-a693-9e088b1edfbb';
```

### Apos Executar a SQL

O registro podera ser reenviado manualmente pelo usuario atraves da interface, agora com a validacao correta de resposta HTTP.

---
