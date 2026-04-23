# Roadmap — Notificações WhatsApp via wa.me

> Estratégia: links `wa.me` (sem custo, sem API Meta). O sistema detecta pendências, gera mensagem pronta a partir de template parametrizável, abre WhatsApp para o usuário revisar e enviar manualmente. Tudo logado para auditoria.
>
> **Mobile-first 9:18** em todas as telas/modais. Permissões via matriz `screen_permissions` + `system_screens`.
>
> Telefone do destinatário: `profiles.telefone` (já existe).

---

## ✅ Módulo 0 — Fundação (em andamento)
Infra reutilizada por todos os módulos.

- [ ] Tabela `notificacoes_whatsapp_templates` (chave única, título, corpo com `{{variaveis}}`, escopo, ativo)
- [ ] Tabela `notificacoes_whatsapp_log` (remetente, destinatário, telefone, template, payload, quando)
- [ ] RLS: admin gerencia templates; authenticated lê; log inserível pelo authenticated, leitura por admin/regional
- [ ] Seeds: `relatorios_cobranca`, `mensalidade_adm_divisao`, `mensalidade_integrante`, `evento_lembrete_hoje`, `evento_lembrete_amanha`, `evento_lembrete_semana`, `generico`
- [ ] Helper `src/lib/whatsapp.ts`: `formatPhoneBR()`, `renderTemplate()`, `buildWaMeLink()`, `logEnvioWhatsApp()`
- [ ] Hook `useWhatsAppTemplates()` (lista/cria/edita/remove)
- [ ] Componente `<BotaoEnviarWhatsApp>` reutilizável (mobile-first 9:18, registra log ao clicar)
- [ ] Tela admin `/admin/notificacoes-whatsapp` com CRUD de templates + log de envios
- [ ] Entrada em `system_screens` + permissões padrão
- [ ] QA manual em mobile 9:18

## ✅ Módulo 1 — Cobrança de Relatórios (8/18/28)
- [x] Detecção: divisões da regional sem relatório do período (1-10, 11-20, 21-fim)
- [x] Tela `/cobranca-relatorios` (acesso: admin, comando, regional, diretor_regional, adm_regional)
- [x] Seletor de período (mostra os 3 últimos com data de cobrança já atingida — dia 8/18/28)
- [x] Lista divisões pendentes + diretor + telefone + botão WhatsApp por linha
- [x] Marca "Já notificado" se houver log no período corrente
- [x] Template `relatorios_cobranca` com `{{nome}}`, `{{divisao}}`, `{{periodo}}`
- [x] Botão "Cobranca de Relatorios" no Dashboard (visível só para quem tem acesso)

## ⏳ Módulo 2 — Cobrança de Mensalidades
- [ ] Pendência na 🔔 do ADM Regional quando há inadimplentes
- [ ] Modal com 2 opções: ADMs de divisão (agrupado) OU integrantes devedores
- [ ] Templates `mensalidade_adm_divisao` e `mensalidade_integrante`

## ⏳ Módulo 3 — Lembretes de Eventos
- [ ] Tela `/lembretes-eventos` com lista de eventos próximos
- [ ] Modal com escopo hierárquico (regional → toda regional/selecionar; divisão → toda divisão/selecionar)
- [ ] Texto dinâmico por proximidade (hoje / amanhã / próxima semana)
- [ ] Lista de destinatários com botão WhatsApp por linha

## ⏳ Módulo 4 — Extras (futuro)
- [ ] Botão WhatsApp em aniversariantes
- [ ] Botão WhatsApp genérico em cards de integrante (gestão/organograma)

---

## Como retomar
> "Continuar plano WhatsApp — módulo X"
