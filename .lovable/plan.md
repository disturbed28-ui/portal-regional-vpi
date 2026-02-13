

## Plano: Importação Automática de Ações Sociais no Servidor (sem depender de usuários conectados)

### Situação Atual

Hoje, a importação automática roda no **navegador** do usuário (`useAutoImportAcoesSociais`). Isso significa que:
- So funciona quando alguem esta logado
- So importa acoes da regional do usuario conectado
- Se ninguem acessar o sistema por horas, nenhuma acao e importada

### Solucao

Criar uma **funcao no servidor** (backend function) que roda automaticamente a cada 60 minutos, **sem depender de ninguem estar conectado**. Ela vai:

1. Ler a planilha do Google Sheets
2. Para **cada regional cadastrada** (VP1, VP2, VP3, Litoral Norte), filtrar as acoes
3. Chamar a funcao de importacao existente para cada regional

### O que sera feito

#### 1. Nova funcao no servidor: `auto-import-acoes-sociais`

Uma nova funcao backend que:
- Busca o ID da planilha do banco de dados (ou usa o padrao)
- Le a planilha via `read-google-sheet`
- Busca todas as regionais cadastradas (exceto CMD, que nao tem divisoes)
- Para cada regional, chama `import-acoes-sociais` com os dados filtrados
- Registra o resultado no log do sistema

#### 2. Agendamento automatico (cron job)

Configurar um agendamento no banco de dados para chamar essa funcao a cada 60 minutos, usando `pg_cron` e `pg_net`:

```text
A cada 60 minutos:
  Servidor -> auto-import-acoes-sociais -> Le planilha Google
                                        -> Para cada regional:
                                             -> Chama import-acoes-sociais
                                        -> Registra log
```

#### 3. Manter o hook do frontend como esta

O hook `useAutoImportAcoesSociais` continuara funcionando normalmente como uma camada extra (redundancia), mas a importacao principal sera pelo servidor.

---

### Detalhes Tecnicos

#### Nova Edge Function: `supabase/functions/auto-import-acoes-sociais/index.ts`

- Usa `SUPABASE_SERVICE_ROLE_KEY` (nao depende de usuario autenticado)
- Busca `google_sheets_acoes_sociais_id` da tabela `system_settings` (fallback para ID padrao)
- Chama `read-google-sheet` internamente via fetch direto (mesma logica de autenticacao Google)
- Busca todas as regionais da tabela `regionais` (excluindo "CMD")
- Para cada regional, mapeia as colunas da planilha e chama `import-acoes-sociais` via `fetch` interno
- Inclui toda a logica de parsing de data (MM/DD/YYYY para ambiguos), normalizacao de headers, etc.
- Registra resultado via `log-system-event`

#### Configuracao no `supabase/config.toml`

```toml
[functions.auto-import-acoes-sociais]
verify_jwt = false
```

#### Cron Job (SQL)

Usar `pg_cron` + `pg_net` para agendar a chamada a cada 60 minutos:

```sql
SELECT cron.schedule(
  'auto-import-acoes-sociais-hourly',
  '0 * * * *',  -- a cada hora, no minuto 0
  $$ SELECT net.http_post(...) $$
);
```

---

### Regionais que serao processadas

| Regional | Sigla | Sera importada |
|----------|-------|----------------|
| VALE DO PARAIBA I - SP | VP1 | Sim |
| VALE DO PARAIBA II - SP | VP2 | Sim |
| VALE DO PARAIBA III - SP | VP3 | Sim |
| LITORAL NORTE - SP | LN | Sim |
| CMD | CMD | Nao (nao tem divisoes/acoes) |

---

### Resultado Esperado

1. A cada 60 minutos, o servidor automaticamente importa novas acoes sociais de **todas** as regionais
2. Nao depende de nenhum usuario estar conectado
3. O hook do frontend continua como camada redundante
4. Resultados de cada execucao ficam registrados nos logs do sistema

