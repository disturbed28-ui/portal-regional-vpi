

## Plano: Tornar detecção de divisão na Agenda dinâmica + corrigir erros de build

### Problema

1. `detectDivisionFromTitle` em `src/lib/googleCalendar.ts` é **hardcoded** com regras fixas para SJC, Jacareí e Caçapava. Qualquer nova divisão (como Santa Branca) não é detectada.
2. Dois arquivos têm erro `Cannot find namespace 'NodeJS'` por usarem `NodeJS.Timeout`.

### Correções

#### 1. Build errors: `NodeJS.Timeout` (2 arquivos)

**`src/hooks/useAutoImportAcoesSociais.tsx` (linha 162)** e **`src/hooks/useIntegrantes.tsx` (linha 64)**:
Substituir `NodeJS.Timeout` por `ReturnType<typeof setTimeout>`.

#### 2. Tornar `detectDivisionFromTitle` dinâmico (`src/lib/googleCalendar.ts`)

Transformar `detectDivisionFromTitle` em função **async** que:

1. Mantém as regras hardcoded existentes (SJC, Jacareí, Caçapava) como **fast path** — são as mais comuns e precisam de lógica especial (combinação cidade+direção).
2. Adiciona um **fallback dinâmico** que consulta o cache de divisões do banco (`loadDivisoesCache()`) e tenta encontrar o nome da divisão no título normalizado do evento.
   - Para cada divisão no banco, extrai o "nome limpo" (sem prefixo "DIVISAO" e sufixo "- SP") e verifica se aparece no título.
   - Exemplo: divisão "DIVISAO SANTA BRANCA - SP" → busca "SANTA BRANCA" no título normalizado.
3. Se encontrar match, retorna o nome formatado da divisão (ex: `'Divisao Santa Branca - SP'`).

Como `detectDivisionFromTitle` passa a ser async, `parseEventComponents` também precisa ser async, e a chamada em `fetchCalendarEvents` já está num loop `for...of` com `await`, então basta adicionar `await`.

#### 3. Invalidar cache de divisões ao adicionar nova divisão

Exportar uma função `invalidateDivisoesCache()` que reseta `divisoesCache = null`, para que novas divisões sejam carregadas na próxima consulta.

### Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useAutoImportAcoesSociais.tsx` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/hooks/useIntegrantes.tsx` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `src/lib/googleCalendar.ts` | `detectDivisionFromTitle` async com fallback dinâmico do banco |

