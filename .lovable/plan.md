# Relatórios gerenciais e fechamento de ciclos

## Objetivo
Acrescentar à aba **Relatórios → Pesquisa de Satisfação** a emissão de PDFs de acompanhamento e o fechamento oficial de ciclos, preservando o painel atual, o formulário público, a planilha e as regras de anonimato e acesso.

## 1. Relatório gerencial
- Adicionar **Gerar Relatório Gerencial**, usando período, regional e divisão selecionados.
- Gerar PDF para download imediato, sem registro obrigatório no histórico, sem limite de emissões e sem encerrar ou congelar nada.
- Incluir quatro indicadores, respostas/efetivo, participação, atividades sugeridas, pontos fortes/fracos, boas práticas, diagnóstico e recomendações. No consolidado regional, incluir panorama das divisões autorizadas.
- Informar data/hora, período, escopo e base de respostas. Identificar como **RELATÓRIO GERENCIAL — ACOMPANHAMENTO**.
- Reutilizar análises existentes; indicar análises pendentes ou indisponíveis sem inventar conclusões.

## 2. Fechamento oficial
- Adicionar **Fechar Ciclo de Avaliação** apenas aos responsáveis autorizados pela hierarquia vigente, com validação também no servidor. A permissão de consultar resultados não concede automaticamente permissão de fechar ciclos.
- Abrir confirmação com nome do ciclo e datas inicial/final preenchidas pelo período selecionado, mantendo meses inteiros conforme o relatório atual.
- O fechamento é regional: preservar consolidado e resultados de todas as divisões autorizadas, independentemente de um filtro divisional usado para acompanhamento.
- Exibir prévia de período, abrangência, quatro indicadores, respostas e efetivo antes da confirmação.
- Confirmar com uma leitura atualizada; se a base mudou desde a prévia, apresentar os resultados atualizados para nova confirmação.
- Bloquear períodos sobrepostos na mesma regional, inclusive em confirmações simultâneas, e impedir contagem da mesma resposta em dois ciclos oficiais.
- Guardar permanentemente os resultados, efetivo de referência, datas, responsável, versão/hash das análises e PDF oficial privado. Novas respostas não alteram o registro histórico e a coleta continua normalmente.
- Não oficializar diagnóstico desatualizado como se estivesse atualizado: aguardar a análise pertinente ou informar indisponibilidade explicitamente antes da confirmação.
- Correções criam revisão vinculada ao fechamento original, com motivo, responsável e data, sem sobrescrever o original ou contar a revisão como um novo período.

## 3. Histórico e comparação
- Criar **Histórico de Ciclos** na mesma aba, com nome, período, data do fechamento, respostas, satisfação geral, variação, visualização e download.
- Aplicar o escopo atual em cada consulta e PDF: a Diretoria de Divisão recebe apenas seus resultados autorizados, nunca o PDF consolidado regional.
- Comparar com o ciclo oficial anterior da mesma regional, mesmo com duração diferente: quatro indicadores em pontos na escala 1–5 e participação em pontos percentuais.
- Comparar temas por proporções de respostas distintas que os mencionam e informar os denominadores e tamanhos das amostras; normalizar temas equivalentes sem somar menções duplicadas.
- Distinguir persistência, surgimento e ausência de temas; ausência de menção não comprova resolução. Não tratar pequenas variações ou amostras insuficientes como melhora comprovada.
- Sem ciclo anterior, mostrar somente os resultados do primeiro fechamento.

## 4. Padrão dos PDFs
- Um modelo compartilhado, leve para impressão, predominantemente branco, com cores do portal, paginação e brasão original VP1 como marca d’água discreta.
- Seções: resumo executivo; pontos fortes; pontos fracos; panorama das divisões; recomendações/pauta e espaço para decisões, responsáveis e prazos; evolução histórica somente no oficial com ciclo anterior.
- Diferenciar claramente acompanhamento e **RELATÓRIO OFICIAL — FECHAMENTO DE CICLO**.
- Não exportar respostas abertas completas, identificadores ou trechos que comprometam o anonimato. Manter mínimo de cinco respostas por divisão e eventuais restrições adicionais já configuradas.
- Usar diagnósticos e recomendações concisos já processados; chamadas adicionais de IA somente quando necessárias, com resultado reaproveitável.

## Detalhes técnicos
- Reutilizar `PesquisaSatisfacaoTab`, a leitura autenticada `pesquisa-satisfacao-relatorio`, os cálculos de participação e o cache `pesquisa_analises`.
- Compartilhar leitura, autorização e montagem dos resultados entre painel e novos recursos, sem modificar as perguntas nem a estrutura da planilha.
- Criar armazenamento aditivo de ciclos e revisões, com acesso protegido, permissões explícitas e proteção contra alteração/exclusão de fechamentos pelo navegador.
- Salvar somente agregados e análises sanitizadas nos snapshots históricos. Manter hashes técnicos das respostas, sem identidade de participantes, para integridade e prevenção de duplicidade.
- Validar fechamento e revisão no servidor e proteger PDFs em armazenamento privado; o servidor fornece somente a versão compatível com o escopo autorizado.
- Conferir o brasão original e o gerador de PDF já usados no projeto antes de escolher a implementação; se o brasão original não estiver disponível, solicitar o arquivo, sem redesenhá-lo.
- Registrar as decisões estruturais em `AGENTS.md` e manter o acompanhamento das tarefas em `roadmap.md`.

## Validação e entrega
- Testar meses completos, sobreposição, concorrência, duplicidade, preservação dos snapshots, revisões e restrições hierárquicas.
- Testar mínimo de cinco respostas, comparação sem anterior, notas em pontos, participação em pontos percentuais e temas em proporções com amostras diferentes.
- Conferir os fluxos reais com sessão autorizada e a apresentação em celular e computador, sem ampliar acesso para testar.
- Gerar PDFs gerencial/oficial, renderizar todas as páginas e corrigir cortes, sobreposição, fontes, marca d’água e paginação.
- Ao entregar, informar funcionalidades, arquivos alterados, armazenamento dos fechamentos, testes realizados e configurações ou validações ainda pendentes; publicação somente mediante pedido.