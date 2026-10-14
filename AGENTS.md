# Decisões técnicas do projeto

- **Cadastro de eventos na agenda via flyer/texto:** o fluxo vive em `src/components/agenda/AdicionarEventoDialog.tsx` + edge functions `interpretar-flyer` (IA extrai campos) e `agenda-criar-evento` (grava no Google Agenda via connector gateway). A escolha da agenda de destino (regional vs. times especiais) lê `agenda_calendars` por nome ("Elite"/"Regional") — nunca fixar IDs de calendário no código. Autoria registrada em `evento_autoria` para edição/exclusão futura pelo autor. Permissão controlada pela matriz (`/agenda/adicionar-evento`), validada no backend via `user_has_screen_permission`.
- **Flyers de eventos:** bucket privado `agenda-flyers` (workspace bloqueia buckets públicos); o link na descrição do evento usa URL assinada de 1 ano.
