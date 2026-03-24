

## Plano: Corrigir status do estágio que não atualiza após todas as aprovações

### Causa raiz

A tabela `solicitacoes_estagio` não tem uma **policy RLS de UPDATE para diretores**. Quando o último aprovador (que não é admin) aprova, o código tenta fazer `UPDATE ... SET status = 'Em Estagio'`, mas o banco **rejeita silenciosamente** por falta de permissão RLS. A tabela de treinamento (`solicitacoes_treinamento`) já tem essa policy — foi adicionada na migration `20260112222058`, mas nunca foi replicada para estágios.

### Solução

Uma única migration SQL que:

1. **Adiciona a policy RLS de UPDATE** na tabela `solicitacoes_estagio` para diretores regionais e de divisão (idêntica à que já existe em `solicitacoes_treinamento`):
   - `diretor_regional` e `diretor_divisao` podem atualizar solicitações da sua regional

2. **Corrige o registro travado do Lenhador** (solicitação `19615fd8-...`):
   - Atualiza status de `'Em Aprovacao'` para `'Em Estagio'`
   - Define `data_aprovacao` como a data da última aprovação

### Nenhuma alteração em código front-end

O código em `useAprovacoesEstagiosPendentes.tsx` já faz a lógica correta (linhas 240-246 e 320-326). O problema é exclusivamente de permissão no banco.

