

## Plano: Corrigir Importação de Ações Sociais (Nova Planilha + Formato de Data)

### Problemas Identificados

Existem **3 problemas** que estão causando o retorno de zero ações:

---

### Problema 1: Inconsistência no parsing de datas ambíguas

Quando a data é ambígua (ex: `2/5/2026` - ambos os números menores que 12), cada parte do sistema trata de forma diferente:

| Local | Caso ambíguo | Resultado para `2/5/2026` |
|-------|-------------|---------------------------|
| **Frontend** (`useAcoesSociaisPendentesGoogleSheet.tsx`) | Assume **DD/MM/YYYY** (brasileiro) | `2026-05-02` |
| **Frontend** (`useAutoImportAcoesSociais.tsx`) | Assume **DD/MM/YYYY** (brasileiro) | `2026-05-02` |
| **Backend** (`import-acoes-sociais/index.ts`) | Assume **MM/DD/YYYY** (americano) | `2026-02-05` |

Essa diferença faz com que o hash gerado no frontend seja diferente do hash gerado no backend, quebrando a deduplicação e potencialmente impedindo a importação correta.

**Se a planilha nova está com formato americano**, a data `1/15/2026` seria parseada corretamente (pois 15 > 12), mas datas como `2/5/2026` seriam interpretadas como dia 2, mês 5 no frontend - gerando uma data **errada**.

---

### Problema 2: `useAutoImportAcoesSociais` usa ID de planilha antigo (hardcoded)

O hook de auto-importação (que roda a cada 60 minutos para todos os usuários) tem o ID da planilha **antiga** fixo no código:

```
const DEFAULT_SPREADSHEET_ID = "1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo";
```

Ele **não lê** a configuração `google_sheets_acoes_sociais_id` do banco de dados. Então mesmo que o admin atualize o ID na tela de Admin, o auto-import continua lendo a planilha antiga.

---

### Problema 3: O `DEFAULT_SPREADSHEET_ID` no hook manual também está desatualizado

O hook `useAcoesSociaisPendentesGoogleSheet.tsx` também tem o ID antigo como fallback (linha 6). Embora ele aceite o ID via parâmetro, o fallback pode causar confusão.

---

### Solução Proposta

#### Alteracao 1: Unificar parsing de data (priorizar formato americano para Google Forms)

Em **todos os 3 locais** (`useAcoesSociaisPendentesGoogleSheet.tsx`, `useAutoImportAcoesSociais.tsx`, `import-acoes-sociais/index.ts`), padronizar o caso ambiguo para **MM/DD/YYYY** (formato americano), que e o padrao do Google Forms:

```typescript
} else {
  // Ambiguo - assumir MM/DD/YYYY (padrao Google Forms americano)
  month = p1.padStart(2, "0");
  day = p2.padStart(2, "0");
}
```

**Arquivos afetados:**
- `src/hooks/useAcoesSociaisPendentesGoogleSheet.tsx` (linha 253)
- `src/hooks/useAutoImportAcoesSociais.tsx` (linha 103)
- O backend (`import-acoes-sociais/index.ts`) ja esta correto (linha 99)

#### Alteracao 2: `useAutoImportAcoesSociais` deve ler o ID da planilha do banco

Modificar o hook para buscar a configuracao `google_sheets_acoes_sociais_id` da tabela `system_settings` antes de chamar a planilha, usando o `DEFAULT_SPREADSHEET_ID` apenas como fallback.

**Arquivo afetado:**
- `src/hooks/useAutoImportAcoesSociais.tsx`

#### Alteracao 3: Atualizar o `DEFAULT_SPREADSHEET_ID` em ambos os hooks

Trocar o ID antigo pelo novo ID da planilha informado pelo usuario:

```
// Antigo: "1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo"
// Novo:   "1k3GBsA3E8IHTBNByWZz895RLvM0FgyHrgDIKl0szha4"
```

**Arquivos afetados:**
- `src/hooks/useAutoImportAcoesSociais.tsx` (linha 10)
- `src/hooks/useAcoesSociaisPendentesGoogleSheet.tsx` (linha 6)

---

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `useAcoesSociaisPendentesGoogleSheet.tsx` | Corrigir caso ambiguo para MM/DD/YYYY; atualizar DEFAULT_SPREADSHEET_ID |
| `useAutoImportAcoesSociais.tsx` | Corrigir caso ambiguo para MM/DD/YYYY; atualizar DEFAULT_SPREADSHEET_ID; buscar ID da planilha do banco |
| `import-acoes-sociais/index.ts` | Nenhuma alteracao necessaria (ja usa MM/DD/YYYY no caso ambiguo) |

---

### Resultado Esperado

1. As datas em formato americano serao corretamente interpretadas
2. O auto-import passara a usar a planilha nova automaticamente
3. Os hashes gerados no frontend e backend serao consistentes, permitindo a deduplicacao correta
4. Novas acoes da planilha serao detectadas e importadas

