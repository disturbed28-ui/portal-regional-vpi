# Notificações WhatsApp em cadeia — Treinamento e Estágio

## Objetivo
Cada passo do fluxo de aprovação passa a abrir uma janela de diálogo para notificar via WhatsApp o próximo responsável, até o fim do fluxo. No fim, o Diretor de Divisão do integrante recebe o aviso de conclusão.

## Fluxo proposto

```text
Cadastro (Solicitação salva)
   -> dialogo: notificar aprovador do nível 1
Aprovador nível 1 aprova
   -> dialogo: notificar aprovador do nível 2
Aprovador nível 2 aprova
   -> dialogo: notificar aprovador do nível 3
Último aprovador aprova (fluxo concluído)
   -> dialogo: notificar Diretor de Divisão do integrante
      "Treinamento/Estágio aprovado com sucesso para <integrante>"
```

Observação: Estágio Grau V tem apenas 1 aprovador (Diretor Regional). Nesse caso o cadastro
notifica o nível 1 e a aprovação dele já dispara o aviso de conclusão.

## O que aparece na tela
Um diálogo padrão (reutilizável) com:
- Nome, cargo e divisão do destinatário
- Prévia da mensagem que será enviada
- Botão verde "Enviar WhatsApp" e botão "Agora não" (nunca bloqueia o fluxo)
- Aviso claro quando o destinatário não tem telefone cadastrado (com nome de quem avisar)

## Mensagens (novos templates, editáveis em Notificações WhatsApp)
- `treinamento_aprovacao_pendente` — "Caro Diretor, {{aprovador}}! ..." com integrante, registro, divisão, cargo em treinamento, nível/etapa da aprovação, solicitante, data de início e término previsto.
- `estagio_aprovacao_pendente` — idem, com grau do estágio.
- `treinamento_aprovado_dd` — aviso de conclusão ao Diretor de Divisão.
- `estagio_aprovado_dd` — aviso de conclusão ao Diretor de Divisão.

Todos os envios continuam registrados em `notificacoes_whatsapp_log` (auditoria já existente).

## Detalhes técnicos

1. **Resolução do telefone do aprovador**
   `aprovacoes_treinamento/_estagio` guardam `aprovador_integrante_id` (integrantes_portal).
   O telefone está em `profiles.telefone` via `integrantes_portal.profile_id`.
   Novo hook `useContatoAprovador(aprovadorIntegranteId)` fará esse join, com fallback:
   se o aprovador não tiver telefone, tenta o Diretor Regional/Divisão correspondente
   (mesma lógica já usada em `useDiretorDivisao`).

2. **Componente novo** `src/components/whatsapp/DialogNotificarAprovacao.tsx`
   - Props: destinatário (nome/cargo/telefone/profile_id), `templateChave`, `payload`, `moduloOrigem`.
   - Carrega o template, renderiza com `renderTemplate`, envia com o mesmo padrão de âncora
     dinâmica já usado (funciona em mobile e dentro do preview).

3. **Hook novo** `src/hooks/useNotificacaoAprovacaoFluxo.tsx`
   - `resolverProximoDestinatario(solicitacaoId, tipo)`: lê as aprovações ordenadas por nível,
     devolve a próxima pendente (ou `{ concluido: true, diretorDivisao }` quando não há mais).
   - Centraliza a decisão para Treinamento e Estágio (mesma forma, tabelas diferentes).

4. **Pontos de integração**
   - `SolicitacaoTreinamento.tsx` / `SolicitacaoEstagio.tsx`: após salvar com sucesso,
     abre o diálogo para o nível 1. Requer que `createSolicitacao` em
     `useSolicitacaoTreinamento`/`useSolicitacaoEstagio` retorne o `id` da solicitação criada
     (hoje retorna apenas `boolean`) — as aprovações são criadas por trigger, então a leitura
     dos aprovadores acontece depois do insert.
   - `AprovacoesPendentes.tsx` / `AprovacaoPendenteEstagio.tsx`: após `aprovar` e após
     `aprovarPorEscalacao` retornarem sucesso, resolve o próximo destinatário e abre o diálogo.
   - Rejeição não notifica próximo (fluxo encerrado) — mantém comportamento atual.

5. **Sem mudanças de regra de acesso.** Nenhuma alteração em RLS; apenas leitura de dados já
   acessíveis ao usuário e inserção no log de notificações (já permitida).

## Melhorias sugeridas
- **Botão "Notificar" persistente no card de aprovação pendente**: se o usuário fechar o diálogo
  sem enviar, o card do fluxo passa a exibir um botão para reenviar/notificar depois. Evita
  perder a notificação por um toque errado.
- **Aviso de aprovador sem telefone**: mostrar no card, para que o ADM regional corrija o cadastro.
- **Notificar também o solicitante** na conclusão (opcional, um segundo botão no diálogo final),
  já que ele acompanha o caso.
- **Anti-duplicidade**: usar `notificacoes_whatsapp_log` para indicar no card se aquela etapa já
  foi notificada (evita cobrança repetida do mesmo aprovador).

## Migração de banco
Somente inserção dos 4 novos templates em `notificacoes_whatsapp_templates`. Nenhuma tabela nova.
