

User clarified: only Pontes should remain inactive. The others (Gordex, Cristian, Tilt, Cursino, Magrão) are all active now, just with stale `data_inativacao`/`motivo_inativacao` fields polluting the record.

Need to verify current state via query before acting, but plan is clear.

## Plano de correção

### 1. Limpar marcações de inativação indevidas (5 integrantes)

Para **Gordex, Cristian, Tilt, Cursino e Magrão**:
- `UPDATE integrantes_portal SET data_inativacao = NULL, motivo_inativacao = NULL WHERE id IN (...)`
- Manter `ativo = true` (já estão ativos)
- Magrão: confirmar se `regional_id`/`divisao_id` já refletem Litoral Norte; se não, sincronizar com a carga atual

### 2. Finalizar inativação do Pontes

- `UPDATE integrantes_portal SET ativo = false WHERE id = '<pontes>'`
- Manter `data_inativacao` e `motivo_inativacao = 'desligado'`

### 3. Trigger de proteção no banco

Criar trigger `trg_sync_ativo_inativacao` em `integrantes_portal` que:
- Se `data_inativacao` e `motivo_inativacao` forem preenchidos com motivos terminais (`desligado`, `transferido`, `outro`) → força `ativo = false`
- Se `motivo_inativacao = 'afastado'` ou `NULL` → mantém `ativo = true`
- Evita futuros estados inconsistentes vindos de qualquer fluxo (UI, edge function, importação)

### 4. Verificação pós-correção

Rodar query de auditoria novamente para confirmar que não há mais registros com `ativo = true AND data_inativacao IS NOT NULL` (exceto casos legítimos de afastamento).

## Arquivos/recursos afetados

- **Migration SQL** (novo): limpeza de dados + criação do trigger
- **Nenhuma alteração de UI** necessária — o problema é apenas de dados + proteção no banco

