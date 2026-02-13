

## Diagnóstico e Correções: Ações Sociais

### Descoberta Principal: O sistema ESTÁ funcionando

A importação automática **está funcionando corretamente**. Na última execução (hoje às 19:39), foram importadas **60 novas ações** das regionais VP1, VP2, VP3 e LN. A execução seguinte (20:00) mostrou "0 inseridos, 120 duplicados" porque **todas as ações disponíveis na planilha já haviam sido importadas** na rodada anterior.

A planilha (`1k3GBsA3E8IHTBNByWZz895RLvM0FgyHrgDIKl0szha4`) possui **apenas 1 aba** ("Respostas ao formulário 1") com 3.370 linhas. O link com `gid=494771071` é uma **visualização filtrada** da mesma aba, não uma aba separada. O sistema já lê todas as linhas dessa aba.

| Regional | Ações no banco | Última ação importada |
|----------|----------------|----------------------|
| VP1 | 132 | 12/02/2026 |
| VP2 | 26 | 11/02/2026 |
| VP3 | 32 | 12/02/2026 |
| LN | 117 | 05/02/2026 |

### Problema Real: Vin Diesel / "Social Vin Diesel"

Existem **2 problemas** com o integrante Vin Diesel:

**Problema A**: Quando ele preenche como "Social Vin Diesel" (em vez de "Vin Diesel"), o sistema não encontra correspondência no cadastro de integrantes. Resultado: a divisão fica como preenchida no formulário ("Divisão Centro") em vez de ser corrigida para "DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP".

- Registro afetado: 1 entrada (data_acao: 09/02/2026, id: `5ced4ea2`)
  - divisao_relatorio_texto: "Divisão Centro" (ERRADO)
  - divisao_relatorio_id: null (ERRADO)

**Problema B**: Mesmo quando o nome é encontrado ("Vin Diesel"), se ele preencher "Centro" como divisão no formulário, a divisão vem da tabela de integrantes (correto). Mas se um novo responsável preencher apenas "Centro" sem estar cadastrado, ficará errado.

### Solução Proposta

#### Correção 1: Corrigir dados existentes no banco (SQL)

Atualizar o registro do "Social Vin Diesel" para apontar para a divisão correta:

```sql
UPDATE acoes_sociais_registros
SET divisao_relatorio_texto = 'DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP',
    divisao_relatorio_id = '6c28d030-dadb-47ba-96a7-5bc383df666d',
    responsavel_divisao_texto = 'DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP'
WHERE id = '5ced4ea2-3b93-4c3a-a454-6465b7958081';
```

#### Correção 2: Melhorar matching de nomes no auto-import

No `auto-import-acoes-sociais`, adicionar lógica para remover prefixos comuns como "Social " do nome do responsável antes de buscar no cadastro de integrantes. Assim, "Social Vin Diesel" será encontrado como "Vin Diesel".

**Arquivo afetado:** `supabase/functions/auto-import-acoes-sociais/index.ts`

Lógica a adicionar antes da busca no `integrantesMap`:

```typescript
// Remover prefixos comuns: "Social ", "S. " etc.
let nomeParaBusca = nomeNormalizado;
if (nomeParaBusca.startsWith('social ')) {
  nomeParaBusca = nomeParaBusca.replace(/^social\s+/, '');
}
```

Então buscar com `nomeParaBusca` além de `nomeNormalizado`.

#### Correção 3: Aplicar mesma lógica no `import-acoes-sociais`

O edge function de importação manual também precisa da mesma melhoria de matching de nomes.

**Arquivo afetado:** `supabase/functions/import-acoes-sociais/index.ts`

### Resumo

| Item | Ação |
|------|------|
| Dados existentes | SQL para corrigir 1 registro do "Social Vin Diesel" |
| `auto-import-acoes-sociais` | Adicionar remoção de prefixo "Social" no matching de nomes |
| `import-acoes-sociais` | Mesma melhoria de matching |

### Resultado Esperado

1. O registro existente do "Social Vin Diesel" será corrigido para a divisão "Centro São José dos Campos"
2. Futuras ações preenchidas como "Social Vin Diesel" serão automaticamente mapeadas para "Vin Diesel" no cadastro
3. O sistema continuará importando normalmente a cada 60 minutos (já está funcionando)

