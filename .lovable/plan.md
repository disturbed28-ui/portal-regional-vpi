

## Plano: Limpar Duplicatas e Corrigir Bug de Deduplicação

### Causa Raiz Identificada

Dois bugs no `auto-import-acoes-sociais`:

1. **Limite de 1000 registros**: A consulta que busca hashes existentes no banco usa o limite padrão do Supabase (1000 linhas). Com 1.231 registros atualmente, cerca de 231 hashes não são carregados, e o sistema re-insere essas ações a cada execução do cron (a cada hora).

2. **hashesNoLote reiniciado por regional**: O controle de duplicatas dentro de cada execução é zerado para cada regional processada. Se uma mesma linha da planilha combina com mais de uma regional, ela é inserida mais de uma vez.

### Escala do Problema

| Ação duplicada | Responsável | Cópias | Deveria ter |
|---|---|---|---|
| Doação mobiliário (17/02) | Mutreta | 52 | 1 |
| Ação Emergencial (16/02) | Figueiredo | 32 | 1 |
| Roupas/Agasalhos (16/02) | Figueiredo | 32 | 1 |
| Ação Emergencial (15/02) | Luanzão | 20 | 1 |
| Visita Humanização (15/02) | Luan | 19 | 1 |
| + outros... | ... | ... | ... |
| **Total duplicatas a remover** | | **219** | |

### Correções

#### 1. Limpar duplicatas existentes (SQL)

Deletar todos os registros duplicados, mantendo apenas o mais antigo de cada hash:

```sql
DELETE FROM acoes_sociais_registros
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY hash_deduplicacao 
      ORDER BY created_at ASC
    ) as rn
    FROM acoes_sociais_registros
    WHERE hash_deduplicacao IS NOT NULL
  ) sub
  WHERE rn > 1
);
```

#### 2. Adicionar constraint UNIQUE no hash (SQL)

Adicionar uma constraint de unicidade na coluna `hash_deduplicacao` para que o banco de dados impeca duplicatas no futuro, independente de bugs no codigo:

```sql
ALTER TABLE acoes_sociais_registros 
ADD CONSTRAINT acoes_sociais_registros_hash_unique 
UNIQUE (hash_deduplicacao);
```

#### 3. Corrigir o limite de 1000 na busca de hashes

**Arquivo:** `supabase/functions/auto-import-acoes-sociais/index.ts`

Buscar hashes em lotes para garantir que TODOS sejam carregados:

```typescript
// Buscar TODOS os hashes existentes (sem limite de 1000)
let allHashes: string[] = [];
let offset = 0;
const pageSize = 1000;
while (true) {
  const { data } = await supabase
    .from('acoes_sociais_registros')
    .select('hash_deduplicacao')
    .not('hash_deduplicacao', 'is', null)
    .range(offset, offset + pageSize - 1);
  if (!data || data.length === 0) break;
  allHashes.push(...data.map(h => h.hash_deduplicacao));
  if (data.length < pageSize) break;
  offset += pageSize;
}
```

#### 4. Tornar hashesNoLote global entre regionais

**Arquivo:** `supabase/functions/auto-import-acoes-sociais/index.ts`

Mover `hashesNoLote` para fora do loop de regionais, para que uma acao processada em VP1 nao seja processada novamente em VP2:

```typescript
// ANTES do loop de regionais (era DENTRO)
const hashesNoLote = new Set<string>();

for (const regional of regionaisAtivas) {
  // ... hashesNoLote agora é compartilhado
}
```

#### 5. Usar upsert com ignoreDuplicates como camada extra

**Arquivo:** `supabase/functions/auto-import-acoes-sociais/index.ts`

Trocar `.insert()` por `.upsert()` com `ignoreDuplicates: true`, para que mesmo se um hash escapar da verificacao em memoria, o banco rejeite a duplicata:

```typescript
const { error } = await supabase
  .from('acoes_sociais_registros')
  .upsert(batch, { 
    onConflict: 'hash_deduplicacao', 
    ignoreDuplicates: true 
  });
```

### Arquivos Afetados

| Arquivo | Alteracao |
|---|---|
| Banco de dados (SQL) | Limpar 219 duplicatas + adicionar constraint UNIQUE |
| `supabase/functions/auto-import-acoes-sociais/index.ts` | Corrigir limite 1000, hashesNoLote global, usar upsert |
| `supabase/functions/import-acoes-sociais/index.ts` | Mesma correção de upsert (importação manual) |
| `supabase/functions/manutencao-acoes-sociais/index.ts` | Revisar se precisa ajuste na lógica de dedup |

### Resultado Esperado

1. 219 registros duplicados serao removidos imediatamente
2. A constraint UNIQUE impede fisicamente novas duplicatas no banco
3. O bug do limite de 1000 é corrigido com paginação
4. hashesNoLote global impede duplicatas entre regionais na mesma execução
5. upsert como camada extra de segurança

