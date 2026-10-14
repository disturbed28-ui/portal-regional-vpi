# Cadastro de Eventos na Agenda via Flyer/Texto

## Objetivo
Botão "Adicionar evento" na tela da Agenda, controlado pela matriz de permissões, permitindo que Graus V e VI cadastrem eventos a partir de flyer (imagem) ou texto. A inteligência lê o flyer, preenche os campos para revisão e grava no Google Agenda.

## Regras confirmadas
- **Quem cadastra:** Graus V e VI, de qualquer divisão/regional (permissão nova na matriz `screen_permissions`, sub-rota da Agenda).
- **Agendas de destino:**
  - Eventos comuns (divisão, regional, Comando) → **AGENDA REGIONAL VP1** (sempre, independente da divisão).
  - Eventos Lobo / Urso / Caveira → **Grupos de Elite Comando V** (agenda diferenciada; o time é identificado no texto do flyer, ex.: "Caveiras VP1").
- **Leitura do flyer:** extrai título/tipo, escopo (divisão/regional/Comando), data (ano sempre corrente), horário, local/endereço, P.E. e contato/responsável. Rodapé institucional é ignorado. Flyers que não são evento (aniversário etc.) são descartados com aviso.
- **Tipos de evento:** Reunião, Pub, Ação Social (inclui Arrecadação e Doação de Sangue — time Social), Bonde Insano, Bate e Volta; Lobo/Urso/Caveira como reuniões de time.
- **Divisão inexistente:** se o flyer menciona regional/divisão que não existe no banco (ex.: "Vale do Paraíba 2, Divisão Pindamonhangaba 3"), o sistema **cria a divisão automaticamente** na regional correspondente antes de gravar o evento.
- **Revisão obrigatória:** antes de gravar, tela de revisão com todos os campos editáveis; nada é salvo sem confirmação.
- **Duplicidade:** verifica evento já existente na agenda (mesmo título/data/local) e avisa antes de gravar.
- **Edição/exclusão:** somente o autor do cadastro (edição/exclusão posterior fica para uma etapa futura; nesta entrega, apenas cadastro).
- **Flyer anexado:** a imagem é guardada no storage e o link é incluído na descrição do evento no Google Agenda.

## Arquitetura

```text
Agenda (botão +, permissão nova)
   └─ Modal "Adicionar evento"
        ├─ Upload do flyer OU colar texto
        ├─ Edge function: interpreta-flyer (IA lê imagem/texto → campos)
        ├─ Tela de revisão (campos editáveis, divisão/regional com autocomplete)
        └─ Confirmar → Edge function: agenda-criar-evento
              ├─ Cria divisão se não existir
              ├─ Verifica duplicidade
              ├─ Grava no Google Agenda (VP1 ou Elite Comando V)
              ├─ Salva flyer no storage + link na descrição
              └─ Registra autor/data no banco (evento_autoria)
```

## Componentes
1. **Permissão:** nova entrada na matriz (`agenda.adicionar_evento`), liberada para Graus V e VI.
2. **Edge function `interpretar-flyer`:** recebe imagem ou texto, usa IA (Lovable AI Gateway, sem chave) com o mapeamento de tipos/times; retorna campos estruturados + aviso se não for evento.
3. **Edge function `agenda-criar-evento`:** valida permissão via matriz, cria divisão ausente, checa duplicidade, cria evento via conexão Google Agenda (gateway), faz upload do flyer e monta a descrição com P.E., contato e link do flyer.
4. **Tabela `evento_autoria`:** registra quem cadastrou cada evento (google_event_id, user_id, created_at) — base para edição/exclusão futura pelo autor.
5. **Frontend:** botão na Agenda (visível conforme permissão), modal com upload/texto, tela de revisão, confirmação e feedback (toast 6s).

## Observações
- Conexão Google Agenda já está ativa e com escrita nas duas agendas necessárias.
- Eventos criados aparecem na Agenda do portal na próxima sincronização (fluxo já existente).
- Custo de IA por leitura de flyer é baixo (confirmado como aceitável).
