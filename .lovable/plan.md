

## Plano: Corrigir flash de botões incorretos no refresh

### Causa raiz

A página Index usa **7 instâncias independentes** de `useUserRole` (1 direta + 6 via `useScreenAccess`), cada uma fazendo sua própria query ao banco. No refresh, essas 7 queries paralelas têm tempos de resposta diferentes, criando estados intermediários inconsistentes onde `loading` de um hook já é `false` enquanto outro ainda carrega — resultando em botões aparecendo brevemente com permissões erradas.

### Solução

Substituir os 6 `useScreenAccess` individuais por um único `useScreenPermissionsBatch` (que já existe no projeto e faz apenas 1 `useUserRole` + 2 queries no total). Isso elimina a race condition.

### Alteração: `src/pages/Index.tsx`

1. **Remover** as 6 chamadas individuais a `useScreenAccess` e `useAdminAccess`
2. **Adicionar** uma única chamada `useScreenPermissionsBatch` com todas as rotas: `['/acoes-sociais', '/listas-presenca', '/relatorios', '/organograma', '/admin', '/gestao-adm']`, usando `'/'` como parentRoute
3. **Extrair** `hasAccess` e `loading` do resultado do batch para cada rota
4. **Manter** a mesma lógica condicional de renderização dos botões, mas usando os dados do batch

Resultado: uma única fonte de verdade para roles e permissões, eliminando o flash de botões incorretos.

