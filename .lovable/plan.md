
## Plano: Corrigir leitura de TODAS as abas da planilha de Ações Sociais

### Problema Identificado

A planilha do Google Sheets tem **múltiplas abas** (tabs/folhas):
- **Aba 1**: "Respostas ao formulário 1" - contém dados até **26 de janeiro de 2026** (3.366 linhas)
- **Aba 2+**: Outras abas (incluindo a do `gid=494771071` que você compartilhou) - contém as **ações novas de fevereiro** que não estão sendo capturadas

A função `read-google-sheet` só lê a **primeira aba**. Por isso, todas as ações novas que estão nas outras abas são invisíveis para o sistema.

### Evidência

- Banco de dados: 992 ações registradas, última importação automática foi às 19:39 de hoje
- Planilha (aba 1): 3.366 linhas, última entrada em 26/01/2026
- Resultado da importação: 120 ações identificadas como duplicatas, 0 novas - porque os dados novos estão em outra aba

### Solução

#### Alteração 1: `read-google-sheet` - suportar leitura de todas as abas

Modificar a função para aceitar um novo parâmetro `allSheets: true`. Quando ativado:
1. Buscar metadados da planilha (já faz isso) para listar TODAS as abas
2. Ler os dados de CADA aba
3. Retornar os dados combinados de todas as abas

Também adicionar retorno da lista de abas disponíveis no resultado, para diagnóstico.

#### Alteração 2: `auto-import-acoes-sociais` - usar `allSheets: true`

Modificar a chamada ao `read-google-sheet` para passar `allSheets: true`, garantindo que TODAS as abas sejam lidas e combinadas antes de processar as ações.

### Detalhes Técnicos

#### `read-google-sheet` - novas capacidades

- Novo parâmetro: `allSheets?: boolean` (default: false, para manter compatibilidade)
- Quando `allSheets = true`:
  - Buscar metadados para listar todas as abas
  - Para cada aba, ler os dados (`{nomeAba}!A:ZZ`)
  - Se `includeHeaders = true`, converter cada aba para objetos usando a primeira linha como headers
  - Combinar todos os dados em um único array
  - Retornar também a lista de abas encontradas (`sheets: string[]`)
- Novo campo no resultado: `sheets: string[]` (nomes de todas as abas)

#### `auto-import-acoes-sociais` - mudança mínima

Alterar apenas a chamada ao `read-google-sheet`:
```typescript
body: JSON.stringify({ spreadsheetId, includeHeaders: true, allSheets: true })
```

### Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/read-google-sheet/index.ts` | Adicionar suporte a `allSheets` para ler todas as abas |
| `supabase/functions/auto-import-acoes-sociais/index.ts` | Passar `allSheets: true` na chamada |

### Resultado Esperado

1. A função passará a ler TODAS as abas da planilha
2. As ações novas (fevereiro e futuras) serão capturadas independente de qual aba estejam
3. O cron job continuará rodando a cada 60 minutos, agora cobrindo todas as abas
