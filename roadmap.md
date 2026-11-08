# Cadastro único no primeiro acesso
- [ ] Reunir nome de colete, telefone obrigatório e Instagram opcional com opção de não informar; salvar tudo junto sem segunda pendência.
- [ ] Validar gravação, retorno à tela inicial e apresentação em celular/computador, preservando análise e permissões.

# Agenda — visitantes externos
- [x] Externos usam exclusão pelo ID da presença, integrantes mantêm justificativa/ausência; seis testes passaram e inclusão/exclusão autenticada de visitante de teste confirmada na tela e no banco, preservando R.pirata e demais presenças reais. Falta publicar a tela no portal.

# Divergência do Gigante — registro 129666
- [x] Vínculos do registro 129666 e perfil corretos na VP2, mas divisão em texto VP1; snapshot de 03/11 correto e de 08/11 divergente, sem auditoria suficiente para atribuir a uma operação específica. Nenhuma outra divergência real entre divisão e vínculo nos ativos (CMD tem apenas diferença de formato).
- [x] Textos de Gigante corrigidos, trigger mantém rótulos coerentes com IDs consistentes; presença usa ID primeiro e leituras paginadas. 12 testes passaram; busca e detalhes conferidos autenticados. Presença antiga no Bonde VP1 preservada, sem criar ou excluir registros para teste.

# Conferência da carga de integrantes
- [x] Cargas de integrantes usam ID global mesmo com mudança de nome/regional; removidos mantêm escopo da carga. Leitura paginada e recuperação ambígua de ID entre arquivos bloqueada; 11 testes passaram, incluindo Gigantes de Vale 2/Centro SJC. Falta publicar e reprocessar os arquivos reais.
- [x] Identificação por ID: removido retorno por nome, ID explícito da planilha preservado e proteção antes de qualquer gravação para conferências antigas. Homônimos testados; função implantada e pedido autenticado com IDs divergentes bloqueado (400), cadastro permaneceu intacto. Reprocessar arquivos da VP3 após publicar a tela.
- [x] Remover cortes de nomes, divisão, cargo e dados de retorno; separar Antes e Depois e usar listas com largura limitada e rolagem vertical. Dois testes passaram; exemplos longos conferidos em 360 e 1280 px sem cortes ou rolagem horizontal. Carga real VP3 não refeita; falta publicar.

# Pesquisa de Satisfação — relatórios e ciclos
- [x] Preparar plano com reutilização do painel, análises e permissões.
- [x] Implementar PDF gerencial, fechamento/revisões com prévia e armazenamento imutável; histórico e comparações numéricas/proporções por título normalizado.
- [x] 23 testes passaram; PDF real da Vale I (104/167) e oito páginas conferidos; corrigidas repetições e datas. Conta Comando não pode fechar (403); funções implantadas e compilação sem erros.
- [x] Adicionar marca d’água com o brasão original fornecido, sem QR e margem externa branca.
- [ ] Conferir aba em celular/computador, fechamento/revisão oficiais e concorrência: sessão disponível não acessa a página Relatórios nem tem cargo autorizado para fechar.
- [ ] Concluir alinhamento semântico dos temas e independência das consultas históricas da planilha; implementação atual documentada em docs/pesquisa-ciclos-entrega.md.

# Aviso de Deslocamento
- [x] Renomear formulário e manter Protocolo de viagem; adicionar avisos dentro da regional e entre regionais, sem data/hora.
- [x] Preservar histórico e permissões; filtrar por tipo, mês ou período; quatro testes passaram e tela autenticada conferida em desktop e celular sem transbordamento.
- [ ] Conferir envio e leitura de um novo aviso: sessão disponível é CMD, sem responsável com telefone nesse escopo; envio bloqueado corretamente. Falta publicar a tela no portal.

# Históricos de Treinamento e Estágio
- [x] Adicionar filtro pelo cargo treinado/estagiado, preservando os demais filtros e acesso; filtros conferidos na sessão autenticada e no celular de 360 px sem rolagem horizontal.
- [x] Exportar todo o histórico autorizado para Excel; downloads reais conferidos (9 treinamentos e 26 estágios, incluindo andamento/concluídos e todos os cargos). Quatro testes passaram; falta publicar a tela no portal.

# Agenda — filtro regional
- [x] Manter eventos do Comando ao selecionar uma regional, preservando filtro de mês e acesso a eventos especiais; seis testes passaram e Agenda autenticada confirmou Coletamento CMD em 22/11 junto com VP1. Falta publicar a alteração no portal.

# Pendências de PD
- [x] Restringir aviso ao Diretor responsável da divisão e ao Diretor/Operacional Regional Grau V da regional correspondente; servidor valida cargo/vínculo/matriz, sem avisos antigos. Dez regras de acesso e sete testes de PD passaram; sessão Comando recebeu zero avisos.
- [ ] Conferir cartão com um PD pendente na sessão de um responsável: sessão disponível é Comando e corretamente não recebe avisos; falta publicar a mudança da janela no portal.

# Histórico de movimentações
- [x] Reforçar saldo regional: afastados continuam integrantes; transferências internas e retornos de afastamento ficam somente no detalhamento divisional. 30 testes passaram e leitura mensal real conferida; validação visual continua bloqueada pelo acesso da sessão a Relatórios.
- [x] Painkiller ativo em Caçapava II/Vale 1: transferência de 28/09 estava salva em outubro; filtrar lançamentos datados pelo mês real sem apagar o registro. Leitura autenticada confirmou exclusão de outubro e 27 testes passaram; exportação atualizada.
- [x] Preservar lançamentos manuais e contar uma única vez o mesmo movimento encontrado depois automaticamente; testes para Helom e Júlio.
- [x] Separar transferências internas (saldo regional zero) de entradas/saídas efetivas; leitura real confirmou Júlio em 21/10, Minero e Helom uma vez cada.
- [x] Capturar entradas novas, saídas, transferências, reativações e afastamentos/retornos em todas as fontes, com paginação; leitura autenticada real retornou 1.277 movimentos.
- [x] Testar as categorias e o resumo mensal: 25 testes passaram; exportação atualizada.
- [ ] Conferir histórico e resumo pela interface: a sessão disponível é redirecionada de Relatórios para início; nenhuma permissão ampliada.

# Relatório CMD — movimentações mensais
- [x] Resumo, meta e exportação usam a leitura mensal compartilhada: leitura autenticada real confirmou Minero/Centro SJC e Helom/Extremo Norte SJC uma vez cada; 11 testes passaram e função de exportação implantada.
- [ ] Validar resumo e arquivo exportado pela interface: a sessão disponível é redirecionada para início ao abrir Relatórios, por falta de acesso à tela; nenhuma permissão foi ampliada.
- [x] Consultar as movimentações do mês de referência sem alterar os demais itens do período; consultas paginadas.
- [x] Incluir afastamentos/retornos e incorporar deltas sem apagar edições manuais.
- [x] Testar limites de mês, virada de ano, retornos e atualização incremental: 7 testes passaram.
- [ ] Conferir movimentações reais na tela: a conta autenticada disponível não retornou integrante ativo vinculado, impedindo carregar divisão e formulário; precisa de sessão de responsável vinculado.

# Frequência — pesos por tipo de evento
- [x] Graduação com o mesmo peso do Coletamento (1,0).
- [x] Ligar o tipo do evento ao peso automaticamente (gatilho no banco).
- [x] Preencher o peso dos eventos que já existem.
- [x] Tirar o Combate do cálculo da frequência.
- [x] Teste da regra de peso/combinação.

# Gestão ADM — Treinamentos
- [x] Aba Encerramento: listar do treinamento mais antigo ao mais novo (os mais próximos de encerrar primeiro).

# Gestão ADM — Estágios
- [x] Aba Encerramento: listar do estágio que vence primeiro para o que vence por último (4 testes e ordem conferida na tela).


# Pesquisa de satisfação pública
- [x] Relatório: comparar respostas com efetivo ativo por escopo e destacar meta de 80%; 13 testes passaram e leitura real confirmou 59/167 na Vale 1.
- [ ] Conferência visual autenticada do indicador: conta de teste bloqueada pela permissão da página Relatórios; nenhuma permissão alterada.
- [x] Preservar formulário fornecido em rota pública isolada e adaptada para celulares.
- [x] Integrar leitura de estrutura e gravação anônima na planilha existente pelo servidor.
- [x] Testar validações, seleção dinâmica e envio com leitura de confirmação.
- [x] Recriar os títulos das colunas se a planilha for limpa; criar planilha nova se ela for apagada.
