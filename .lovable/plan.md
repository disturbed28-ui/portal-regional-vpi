

## Confirmação

O plano já está com o critério de **50 dias**. Nenhuma alteração necessária no plano apresentado anteriormente.

### Resumo das alterações a implementar

1. **`src/pages/Index.tsx`** — Incluir `adm_regional` na detecção de role regional
2. **`src/hooks/usePendencias.tsx`** — Novo tipo `desligamento_compulsorio`: 2+ parcelas vencidas E maior atraso >= **50 dias**. Visível para `admin`, `regional` (inclui `adm_regional`)
3. **`src/components/PendenciasModal.tsx`** — Card visual vermelho com alerta "DESLIGAMENTO COMPULSÓRIO"

Critério: `parcelas >= 2 AND maior_atraso_dias >= 50`

