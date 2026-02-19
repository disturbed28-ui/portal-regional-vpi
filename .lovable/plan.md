

## Plano: Corrigir duplicação de ações sociais no Relatório Semanal

### Problema Identificado

Duas falhas no formulário `FormularioRelatorioSemanal.tsx`:

**Bug 1 - Query sem filtro**: A busca de ações da "semana atual" (linha 893) traz TODAS as ações da divisão no período, sem filtrar por `foi_reportada_em_relatorio = false`. Resultado: ações já reportadas em relatórios anteriores aparecem novamente.

**Bug 2 - Marcação só no UPDATE**: No hook `useRelatorioSemanal.tsx`, as ações sociais só são marcadas como `foi_reportada_em_relatorio = true` no fluxo de UPDATE (quando já existe relatório). No fluxo de INSERT (primeiro envio), as ações nunca são marcadas como reportadas - linhas 47-55 fazem o insert mas não executam a marcação das ações.

### Correções

#### Correção 1: Filtrar ações já reportadas na query da semana atual

**Arquivo:** `src/pages/FormularioRelatorioSemanal.tsx`

Adicionar `.eq("foi_reportada_em_relatorio", false)` na query da semana atual (linha 893-898), igual já é feito na query da semana anterior (linha 907). Assim, ações já incluídas em relatórios anteriores não voltam a aparecer.

#### Correção 2: Marcar ações como reportadas também no INSERT

**Arquivo:** `src/hooks/useRelatorioSemanal.tsx`

Mover a lógica de marcação de ações (linhas 81-92) para DEPOIS do bloco if/else, de forma que ela execute tanto no INSERT quanto no UPDATE. Atualmente, o `return data` na linha 55 impede que o código de marcação (linhas 81-92) seja alcançado no fluxo de primeiro envio.

### Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `src/pages/FormularioRelatorioSemanal.tsx` | Adicionar filtro `foi_reportada_em_relatorio = false` na query da semana atual |
| `src/hooks/useRelatorioSemanal.tsx` | Marcar ações como reportadas tanto no INSERT quanto no UPDATE |

### Resultado Esperado

1. Ao abrir o formulário, somente ações **não reportadas** serão carregadas automaticamente
2. Ao enviar o relatório pela primeira vez (INSERT), as ações serão marcadas como reportadas
3. Relatórios futuros não exibirão ações já incluídas em relatórios anteriores
