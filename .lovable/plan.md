# Módulo Avaliação de Integrantes — Plano de Implementação

## Premissas confirmadas
1. **Histórico de grau**: usar `atualizacoes_carga` filtrando `campo_alterado = 'grau'` para obter a última promoção de cada integrante (origem oficial das cargas, já alimentado).
2. **Gestão de períodos**: nova aba dentro de `/gestao-adm`, ao lado de "Critérios de Avaliação".
3. **Critérios**: por regional (campo `regional_id NOT NULL`).
4. **Acesso**: 100% via `system_screens` + `screen_permissions`. Grau define apenas escopo de dados (V = regional, VI+ = divisão, I-IV = tudo).

---

## 1. Banco de dados (uma migração)

### Tabelas
- **`avaliacao_periodos`**: `id, nome, ano (int), semestre (1|2), regional_id (FK), status ('aberto'|'encerrado'), data_inicio, data_fim, criado_por, encerrado_por, encerrado_em, created_at, updated_at`
  - UNIQUE `(regional_id, ano, semestre)`
- **`criterios_avaliacao`**: `id, regional_id, nome, descricao, ativo, ordem, created_at, updated_at`
  - Soft delete via `ativo=false`. Sem DELETE físico.
- **`avaliacoes_integrantes`**: `id, periodo_id, integrante_id, criterio_id, avaliador_id (text), avaliador_nome, status ('sim'|'nao'), observacao, created_at, updated_at`
  - UNIQUE `(periodo_id, integrante_id, criterio_id)` para upsert
  - Trigger bloqueia INSERT/UPDATE quando `periodo.status='encerrado'`

### RLS (todas baseadas em `screen_permissions` + escopo por grau)
- SELECT: usuário com permissão na tela `/avaliacao-integrantes`, restrito ao escopo (Grau V → mesma `regional_id`, Grau VI+ → mesma `divisao_id` do integrante avaliado).
- INSERT/UPDATE de `avaliacoes_integrantes`: mesmo escopo + período aberto.
- Critérios e períodos: gerenciados por quem tem permissão na tela `/gestao-adm` (subitens "Critérios de Avaliação" e "Gestão de Períodos de Avaliação").

### `system_screens` (novas entradas)
- `/avaliacao-integrantes` (rota principal)
- `/gestao-adm/criterios-avaliacao` (subtela)
- `/gestao-adm/periodos-avaliacao` (subtela)

Permissões iniciais: `admin`, `comando`, `diretor_regional`, `adm_regional` para gestão; mais `diretor_divisao` para a tela de avaliação.

---

## 2. Frontend

### Nova rota `/avaliacao-integrantes` (`src/pages/AvaliacaoIntegrantes.tsx`)
Duas abas:

**Aba "Avaliação"**
- Selector de período: pré-seleciona o período atual aberto (jan-jun → semestre 1, jul-dez → semestre 2). Sem período aberto → alerta bloqueante.
- Lista integrantes ativos (`ativo = true`) do escopo, agrupados por divisão (ordem do organograma) e ordenados por hierarquia (`integranteOrdering`).
- Cada integrante = accordion (1 aberto por vez). Card mostra: foto, nome completo, nome de colete, divisão, regional, grau, cargo, data de entrada.
  - **Destaque visual** quando a última promoção (de `atualizacoes_carga` campo `grau`) tem < 6 meses — badge "Promoção recente" para reforçar regra dos 6 meses.
- Para cada critério ativo da regional: botões Sim/Não, com upsert imediato e feedback visual (cor verde/vermelho).

**Aba "Histórico"**
- Filtros: período (obrigatório), divisão (se escopo permitir), integrante (opcional).
- Tabela com avaliação por critério.
- Exportar Excel reaproveitando ExcelJS (cores do CMD, mesmo padrão do `ListasConsulta`).

### `/gestao-adm` — duas novas abas
- **Critérios de Avaliação**: CRUD (criar, ativar/desativar, reordenar). Ativos primeiro, inativos depois.
- **Gestão de Períodos de Avaliação**: criar período (auto-preenche nome `<ANO>/<SEMESTRE>`), ver status (Aberto/Encerrado/Pendências), contadores (total no escopo, avaliados, pendentes).
  - Botão "Encerrar": só permite quando todos os integrantes ativos da regional têm pelo menos 1 avaliação no período. Caso contrário, mostra resumo de pendências por divisão.

### Hooks novos
- `usePeriodosAvaliacao`, `useCriteriosAvaliacao`, `useAvaliacoesIntegrantes`, `useUltimaPromocaoGrau` (consulta `atualizacoes_carga`).

### App.tsx
Adicionar `<Route path="/avaliacao-integrantes" element={<AvaliacaoIntegrantes />} />`.

### Padrões reutilizados
`useScreenPermissionsBatch`, `useUserRole`, `useIntegrantesGestao`, `normalizarTextoHierarquia`, `integranteOrdering`, `escopoCarga`. Mobile 9:18 (cards no lugar de tabelas), toasts Sonner 6000ms não-dismissíveis, datas `.toISOString()`, paginação `.range()` se >1000 linhas.

---

## Ordem de execução
1. Migração (3 tabelas + RLS + triggers + entradas em `system_screens` + permissões iniciais).
2. Hooks de dados.
3. Página `/avaliacao-integrantes` (abas Avaliação + Histórico).
4. Abas em `/gestao-adm` (Critérios + Períodos).
5. Export Excel formatado.
6. QA mobile + verificação de permissões.

Posso começar pela migração?
