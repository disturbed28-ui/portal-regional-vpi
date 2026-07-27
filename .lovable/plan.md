## Problema

Hoje o título exibido na agenda é reconstruído a partir de: `[SIGLA] Tipo - Divisão - Extras`.

O trecho "Extras" (o complemento que o autor escreveu no Google Agenda) quase sempre se perde nos eventos de **divisão**, porque o código procura no título original a string formatada `"Divisao Sao Jose dos Campos Extremo Norte - SP"` — que nunca aparece literalmente num título como `PUB EXT NORTE - ANIVERSÁRIO DIVISÃO SANTA ISABEL`. Resultado: fica só `PUB - Divisao ... Extremo Norte`.

Casos citados:
- `PUB EXT NORTE – ANIVERSÁRIO DA DIVISÃO SANTA ISABEL` → hoje: "PUB - Divisao SJC Extremo Norte - SP"
- `AÇÃO SOCIAL EXT NORTE – PALESTRA ...` → hoje perde a palestra

## Solução

Trocar a extração de extras por uma função de **texto residual**: em vez de "achar a divisão no título", remover do título original tudo que já é representado nos outros campos e manter o que sobrar.

Etapas do residual (em `src/lib/googleCalendar.ts`):

1. Remover as palavras do **tipo de evento** detectado (pub, ação social, reunião, bate e volta, bonde insano, arrecadação, entrega de coletes).
2. Remover os **tokens da divisão detectada** e seus apelidos (EXT NORTE, EXTREMO NORTE, SJC, JAC, nome completo da divisão, "DIVISÃO", "- SP"), mas **apenas a ocorrência que identificou a divisão do evento** — se o título citar outra divisão (Santa Isabel), ela é preservada.
3. Remover **sigla regional** (VP1/VPI/LN/CMD) e palavras "REGIONAL"/"COMANDO".
4. Limpar conectores/pontuação sobrando nas bordas (`-`, `–`, `:`, `|`, parênteses vazios) e espaços duplicados.
5. O que sobrar (se ≥ 3 caracteres e não for só stopword como "DA", "DE", "DO") vira `informacoesExtras`.

Isso vale para os 4 ramos: divisão, regional, CMD e Caveira (nos casos com palavra-chave, o comportamento atual de manter o restante continua).

## Abreviação / encurtamento

Nova função `abreviarExtras(texto, limite)`:

- Dicionário de abreviações aplicadas por palavra inteira:
  `ANIVERSÁRIO→ANIV.`, `DIVISÃO→DIV.`, `REGIONAL→REG.`, `COMANDO→CMD`, `CONFRATERNIZAÇÃO→CONFRAT.`, `COMEMORAÇÃO→COMEM.`, `INTEGRAÇÃO→INTEGR.`, `ARRECADAÇÃO→ARREC.`, `ANIVERSARIANTES→ANIVERS.`, `SÃO JOSÉ DOS CAMPOS→SJC`, `JACAREÍ→JAC`, `EXTREMO→EXT`, `PALESTRA` (mantida), `SOLIDÁRIA/SOLIDARIEDADE→SOLID.`, `CAMPANHA→CAMP.`, `MOTOCICLISTA→MOTOC.`, `HOMENAGEM→HOMEN.`, `ANIVERSÁRIO DE FUNDAÇÃO→ANIV. FUNDAÇÃO`.
- Remove artigos/preposições redundantes ("DA", "DO", "DE", "DOS") quando o texto passa do limite.
- Limite de **48 caracteres**; se ainda exceder, corta na última palavra inteira e adiciona `…`.
- O texto completo original nunca se perde: `originalTitle` continua salvo e será exibido inteiro no modal de detalhes.

Resultado esperado:
- `[VP1] PUB - Divisao SJC Extremo Norte - SP - ANIV. DIV. SANTA ISABEL`
- `[VP1] Acao Social - Divisao SJC Extremo Norte - SP - PALESTRA ...`

## Exibição

- **EventCard**: título normalizado (com extras abreviados) — sem quebrar o layout mobile.
- **EventDetailDialog**: além dos campos atuais, exibir uma linha "Título original" com o texto integral do Google Agenda, para nunca perder informação.

## Detalhes técnicos

Arquivos alterados:
- `src/lib/googleCalendar.ts` — nova `extrairInformacoesExtras()` e `abreviarExtras()`, usadas nos 4 ramos de `parseEventComponents`; `buildNormalizedTitle` passa a aplicar a abreviação.
- `src/components/agenda/EventDetailDialog.tsx` — nova linha com o título original.

Sem mudanças de banco. A classificação de tipo/divisão/regional e as regras de palavras-chave (Caveira/Lobo/Ursinho) permanecem exatamente como estão.
