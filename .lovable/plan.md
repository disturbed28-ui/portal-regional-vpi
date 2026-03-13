

## Plano: Ajuste de visibilidade — Admin com Grau V+ vê regional (somente em telas Admin)

### Regra consolidada

| Contexto | Admin + Grau I-IV | Admin + Grau V+ | Não-admin |
|---|---|---|---|
| **Telas normais** (Relatórios, Ações Sociais, Listas, etc.) | Tudo (comando) | Segue grau estrito (V=regional, VI+=divisão) | Segue grau estrito |
| **Telas de Administração** (/admin*) | Tudo | Toda a regional | N/A (não tem acesso) |

### Alterações

#### 1. Utilitário `grauUtils.ts` — nova função auxiliar

Criar `getNivelAcessoAdmin(grau)` que retorna `'regional'` para qualquer Grau V+ (em vez de `'divisao'`). Ou seja, no contexto admin, Grau VI, VII, VIII... são tratados como regional.

```
getNivelAcessoAdmin('V')   → 'regional'
getNivelAcessoAdmin('VI')  → 'regional'  // diferença: normalmente seria 'divisao'
getNivelAcessoAdmin('III') → 'comando'   // sem mudança
```

#### 2. Telas NÃO-admin — remover `isAdmin ||` (6 arquivos)

Mesma alteração do plano anterior aprovado:

- `src/hooks/useAcoesSociaisLista.tsx` — linha 42: `isAdmin || nivel === 'comando'` → `nivel === 'comando'`
- `src/hooks/useIntegrantesRelatorio.tsx` — linha 145: `isAdmin || nivelAcesso === 'comando'` → `nivelAcesso === 'comando'`
- `src/pages/AcoesSociais.tsx` — linha 39: `isAdmin || nivel === 'comando'` → `nivel === 'comando'`
- `src/components/listas/ListasConsulta.tsx` — remover `isAdmin` dos checks
- `src/components/listas/FrequenciaIndividual.tsx` — remover `isAdmin ||` dos checks
- `src/components/listas/FrequenciaDashboard.tsx` — remover `isAdmin ||` dos checks

#### 3. Telas Admin — adicionar filtragem por regional para Grau V+

Atualmente as telas Admin (ex: `AdminIntegrantes.tsx`) carregam TODOS os integrantes sem filtro de hierarquia. Para admins com Grau V+, adicionar filtro por `regional_id` do profile do usuário.

**Arquivo principal: `src/pages/AdminIntegrantes.tsx`**
- Importar `getNivelAcessoAdmin` e `useProfile`
- Filtrar lista de integrantes: se `nivelAdmin !== 'comando'`, mostrar apenas integrantes com `regional_id === profile.regional_id`
- Isso afeta a visualização da lista, busca e estatísticas

Outras telas admin que exibem dados filtráveis (se aplicável) seguirão o mesmo padrão.

### Resumo

- Telas comuns: visibilidade determinada **exclusivamente** pelo grau (admin não expande escopo)
- Telas admin: admin com Grau V+ vê **toda a regional** (não fica limitado à divisão), admin com Grau I-IV vê tudo

