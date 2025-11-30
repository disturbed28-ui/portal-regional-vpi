import { useRelatorioSemanalResumo } from '@/hooks/useRelatorioSemanalResumo';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { RelatorioTable } from './RelatorioTable';
import { EstatisticasEspeciais } from './EstatisticasEspeciais';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioSemanalResumoProps {
  regionalId: string;
  ano: number;
  mes: number;
  semana: number;
}

export const RelatorioSemanalResumo = ({ regionalId, ano, mes, semana }: RelatorioSemanalResumoProps) => {
  // Buscar dados do relatório (mesma lógica da aba "Relatório")
  const { data: dadosRelatorio, isLoading: loadingRelatorio } = useRelatorioSemanalResumo(regionalId);

  // Buscar nome da regional
  const { data: regional } = useQuery({
    queryKey: ['regional', regionalId],
    queryFn: async () => {
      const { data } = await supabase
        .from('regionais')
        .select('nome')
        .eq('id', regionalId)
        .single();
      return data;
    },
    enabled: !!regionalId,
  });

  // Buscar dados dos formulários semanais
  const { data: relatoriosSemanais, isLoading: loadingSemanais } = useQuery({
    queryKey: ['relatorios-semanais', regionalId, ano, mes, semana],
    queryFn: async () => {
      const { data } = await supabase
        .from('relatorios_semanais_divisao')
        .select('*')
        .eq('regional_relatorio_id', regionalId)
        .eq('ano_referencia', ano)
        .eq('mes_referencia', mes)
        .eq('semana_no_mes', semana);
      return data || [];
    },
    enabled: !!regionalId,
  });

  if (loadingRelatorio || loadingSemanais) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!dadosRelatorio) return null;

  // Consolidar dados dos formulários
  const entradasDetalhadas: any[] = [];
  const saidasDetalhadas: any[] = [];
  const inadimplencias: any[] = [];
  const conflitosInternos: any[] = [];
  const conflitosExternos: any[] = [];
  const acoesSociais: any[] = [];

  relatoriosSemanais?.forEach(relatorio => {
    const divisaoNome = relatorio.divisao_relatorio_texto;
    
    // Entradas
    const entradas = (relatorio.entradas_json as any[]) || [];
    entradas.forEach(e => entradasDetalhadas.push({ ...e, divisao: divisaoNome }));
    
    // Saídas
    const saidas = (relatorio.saidas_json as any[]) || [];
    saidas.forEach(s => saidasDetalhadas.push({ ...s, divisao: divisaoNome }));
    
    // Inadimplências
    const inad = (relatorio.inadimplencias_json as any[]) || [];
    inad.forEach(i => inadimplencias.push({ ...i, divisao: divisaoNome }));
    
    // Conflitos
    const conflitos = (relatorio.conflitos_json as any[]) || [];
    conflitos.forEach(c => {
      if (c.tipo === 'interno') {
        conflitosInternos.push({ ...c, divisao: divisaoNome });
      } else {
        conflitosExternos.push({ ...c, divisao: divisaoNome });
      }
    });
    
    // Ações Sociais
    const acoes = (relatorio.acoes_sociais_json as any[]) || [];
    acoes.forEach(a => acoesSociais.push({ ...a, divisao: divisaoNome }));
  });

  return (
    <div className="space-y-4">
      {/* Seção 1: Dados do Relatório (mesmos da aba "Relatório") */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Relatório - {regional?.nome}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RelatorioTable 
            divisoes={dadosRelatorio.divisoes} 
            totais={dadosRelatorio.totais}
            regionalNome={regional?.nome}
          />
          
          <EstatisticasEspeciais 
            divisoes={dadosRelatorio.divisoes} 
            totais={dadosRelatorio.totais}
          />
        </CardContent>
      </Card>

      {/* Seção 2: Dados dos Formulários Semanais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados dos Relatórios Semanais - Ano {ano} / Mês {mes} / Semana {semana}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* Entradas Detalhadas */}
            {entradasDetalhadas.length > 0 && (
              <AccordionItem value="entradas">
                <AccordionTrigger>
                  Entradas Detalhadas ({entradasDetalhadas.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entradasDetalhadas.map((entrada, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{entrada.divisao}</TableCell>
                          <TableCell>{entrada.nome_colete}</TableCell>
                          <TableCell>
                            {entrada.data_entrada && format(new Date(entrada.data_entrada), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{entrada.motivo_entrada || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Saídas Detalhadas */}
            {saidasDetalhadas.length > 0 && (
              <AccordionItem value="saidas">
                <AccordionTrigger>
                  Saídas Detalhadas ({saidasDetalhadas.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saidasDetalhadas.map((saida, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{saida.divisao}</TableCell>
                          <TableCell>{saida.nome_colete}</TableCell>
                          <TableCell>
                            {saida.data_saida && format(new Date(saida.data_saida), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{saida.justificativa || saida.motivo_codigo || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Inadimplências */}
            {inadimplencias.length > 0 && (
              <AccordionItem value="inadimplencias">
                <AccordionTrigger>
                  Inadimplências ({inadimplencias.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Ação de Cobrança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inadimplencias.map((inad, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{inad.divisao}</TableCell>
                          <TableCell>{inad.nome_colete}</TableCell>
                          <TableCell>{inad.acao_cobranca || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Conflitos Internos */}
            {conflitosInternos.length > 0 && (
              <AccordionItem value="conflitos-internos">
                <AccordionTrigger>
                  Conflitos Internos ({conflitosInternos.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conflitosInternos.map((conflito, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{conflito.divisao}</TableCell>
                          <TableCell>
                            {conflito.data && format(new Date(conflito.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{conflito.descricao}</TableCell>
                          <TableCell>{conflito.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Conflitos Externos */}
            {conflitosExternos.length > 0 && (
              <AccordionItem value="conflitos-externos">
                <AccordionTrigger>
                  Conflitos Externos ({conflitosExternos.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conflitosExternos.map((conflito, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{conflito.divisao}</TableCell>
                          <TableCell>
                            {conflito.data && format(new Date(conflito.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{conflito.descricao}</TableCell>
                          <TableCell>{conflito.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Ações Sociais */}
            {acoesSociais.length > 0 && (
              <AccordionItem value="acoes-sociais">
                <AccordionTrigger>
                  Ações Sociais ({acoesSociais.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acoesSociais.map((acao, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{acao.divisao}</TableCell>
                          <TableCell>{acao.titulo || '-'}</TableCell>
                          <TableCell>
                            {acao.data_acao && format(new Date(acao.data_acao), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {relatoriosSemanais?.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Nenhum relatório semanal encontrado para este período.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
