# Pesquisa de Satisfação — implementação e pendências

## Implementado
- Botão de PDF gerencial respeitando filtros, sem fechamento ou alteração da coleta.
- Prévia regional, confirmação explícita e validação de mudança dos resultados antes do fechamento.
- Fechamento restrito ao Diretor Regional Grau V ativo da regional, com permissão vigente de acesso ao relatório; nenhum privilégio genérico concede fechamento.
- Ciclos permanentes e revisões rastreáveis, sem sobrescrever versões anteriores.
- Histórico com consulta, versões e download; recorte por divisão aplicado no servidor.
- Comparação descritiva de notas, participação e proporções de temas com amostras informadas.
- PDFs compartilhados, com paginação, identidade de impressão, agregados e recomendações; sem respostas abertas completas.

## Armazenamento
`pesquisa_ciclos` registra regional, nome, meses, autor e data. `pesquisa_ciclo_versoes` guarda snapshot sanitizado, PDF oficial em base64, hash, versão e motivo. Somente o serviço autenticado alcança esses registros; o navegador não possui privilégios diretos. Gatilhos impedem alteração/exclusão. A função `pesquisa_registrar_ciclo` grava ciclo e primeira versão juntos e serializa operações por regional com lock, validando sobreposição. O PDF gerencial não é salvo automaticamente.

## Arquivos principais
- `src/components/relatorios/PesquisaSatisfacaoTab.tsx`
- `src/components/relatorios/PesquisaCiclos.tsx`
- `src/lib/pesquisaCiclos.test.ts`
- `supabase/functions/pesquisa-ciclos/index.ts`
- `supabase/functions/pesquisa-ciclos/pdf.ts`
- `supabase/functions/_shared/pesquisaCiclos.ts`
- `supabase/functions/_shared/pesquisaHash.ts`
- `supabase/functions/pesquisa-satisfacao-relatorio/index.ts`
- `supabase/functions/pesquisa-satisfacao-relatorio/calculo.ts`
- `drizzle/migrations/0014_pesquisa_ciclos_oficiais.sql` e metadados gerados
- `src/integrations/supabase/types.ts` gerado
- `package.json`, `bun.lock`, `AGENTS.md`, `roadmap.md`

## Verificado
- 23 testes passaram: participação existente e novas regras de autorização, sobreposição, recorte, anonimato, snapshots e comparação.
- Esquema novo confirmado no banco e funções implantadas.
- Consulta autenticada real: 104 respostas, efetivo 167, dez divisões em setembro–novembro de 2026 na Vale I.
- PDF gerencial real gerado e oito páginas renderizadas e inspecionadas. Corrigidas repetições de avisos, datas técnicas e excesso de detalhamento divisional; sem cortes ou sobreposições visíveis na revisão final.
- Conta Comando disponível recebeu histórico vazio e fechamento negado (403), como esperado.
- A interface redireciona essa conta de `/relatorios` ao início; nenhuma permissão foi ampliada para testar.
- Último sinal de compilação: sem erros.

## Ainda não concluído
- Brasão original fornecido e integrado como marca d’água nos PDFs novos, com recorte circular removendo QR e margem branca externa, sem redesenho; PDFs oficiais já armazenados permanecem imutáveis.
- Conferência visual da aba em computador/celular e fechamento/revisão/download oficial completos dependem de uma sessão com acesso à página e autorização para fechar. Nenhum ciclo real foi criado apenas para teste.
- Testes de concorrência/imutabilidade contra registros reais e inspeção do PDF oficial ainda pendentes; as proteções foram implementadas, mas não se deve afirmar validação completa.
- Comparação qualitativa alinha títulos normalizados, não equivalência semântica entre títulos diferentes; análise aprofundada de evolução dos temas ainda não implementada. O PDF informa essa limitação e não chama ausência de menção de resolução.
- Histórico consulta resultados atuais para reutilizar autorização; separar autorização da leitura da planilha, sem mudar permissões, ainda é necessário para permitir consultas históricas quando a integração Sheets estiver indisponível.
- Publicação da interface ainda necessária, somente mediante pedido.

Não há novas credenciais exigidas: utiliza as conexões existentes.