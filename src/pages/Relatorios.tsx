import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useScreenAccess } from '@/hooks/useScreenAccess';
import { useProfile } from '@/hooks/useProfile';
import { useRelatorioData } from '@/hooks/useRelatorioData';
import { useHistoricoCargas } from '@/hooks/useHistoricoCargas';
import { RelatorioTable } from '@/components/relatorios/RelatorioTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardInadimplencia } from '@/components/relatorios/DashboardInadimplencia';
import { EstatisticasEspeciais } from '@/components/relatorios/EstatisticasEspeciais';
import { GraficoEvolucao } from '@/components/relatorios/GraficoEvolucao';
import { TabelaComparativa } from '@/components/relatorios/TabelaComparativa';
import { RelatorioSemanalDivisaoAba } from '@/components/relatorios/RelatorioSemanalDivisaoAba';
import { formatarDataBrasil } from '@/lib/timezone';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { useAfastadosAtivos, useAfastadosHistorico, useRetornosProximos, useRegistrarRetorno } from '@/hooks/useAfastados';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Users, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardDescription } from '@/components/ui/card';
import { toast as sonnerToast } from 'sonner';

const Relatorios = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasRole, loading: rolesLoading } = useUserRole(user?.id); // mantido para UI interna
  const { hasAccess, loading: loadingAccess } = useScreenAccess("/relatorios", user?.id);
  const { hasAccess: hasAccessSemanalAba, loading: loadingAccessSemanalAba } = useScreenAccess('/relatorios/semanal-divisao', user?.id);

  const { data: relatorioData, isLoading } = useRelatorioData();
  const { data: historicoData, isLoading: isLoadingHistorico } = useHistoricoCargas({
    enabled: !!user?.id && hasAccess && !loadingAccess
  });

  // Hooks para afastamentos
  const { afastados: ativos, loading: loadingAtivos, refetch: refetchAtivos } = useAfastadosAtivos();
  const { afastados: historico, loading: loadingHistorico } = useAfastadosHistorico();
  const { afastados: proximos7, loading: loadingProximos7 } = useRetornosProximos(7);
  const { afastados: proximos30, loading: loadingProximos30 } = useRetornosProximos(30);
  const { registrarRetorno } = useRegistrarRetorno();
  
  // Redirecionamento em caso de acesso negado
  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (user && !profileLoading && profile && !profile.nome_colete) {
      toast({
        title: "Complete seu cadastro",
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [user, profileLoading, profile, navigate]);

  // Funções auxiliares para afastamentos
  const handleRegistrarRetorno = async (afastadoId: string, nomeColete: string) => {
    try {
      await registrarRetorno(afastadoId);
      sonnerToast.success(`Retorno de ${nomeColete} registrado com sucesso!`);
      refetchAtivos();
    } catch (error) {
      sonnerToast.error('Erro ao registrar retorno');
    }
  };

  const getDiasRestantes = (dataRetorno: string) => {
    const hoje = new Date();
    const retorno = new Date(dataRetorno);
    return differenceInDays(retorno, hoje);
  };

  const getStatusRetorno = (dataRetornoPrevista: string, dataRetornoEfetivo: string | null) => {
    if (!dataRetornoEfetivo) return null;
    
    const prevista = new Date(dataRetornoPrevista);
    const efetiva = new Date(dataRetornoEfetivo);
    const diff = differenceInDays(efetiva, prevista);
    
    if (diff === 0) return { label: 'No prazo', variant: 'default' as const };
    if (diff < 0) return { label: `${Math.abs(diff)}d adiantado`, variant: 'default' as const };
    return { label: `${diff}d atrasado`, variant: 'destructive' as const };
  };

  // Dashboard stats para afastamentos
  const totalAtivos = ativos.length;
  const retornosAtrasados = ativos.filter(a => getDiasRestantes(a.data_retorno_prevista) < 0).length;
  const divisoesAfetadas = new Set(ativos.map(a => a.divisao_texto)).size;

  const handleExportExcel = () => {
    if (!relatorioData) return;

    try {
      const wb = XLSX.utils.book_new();
      const dataAtual = new Date().toLocaleDateString('pt-BR');

      // ===== SHEET 1: Relatório Regional =====
      const sheet1Data: any[][] = [
        ['RELATÓRIO REGIONAL'],
        [`Data: ${dataAtual}`],
        [],
        ['DIVISÕES', 'Entrada', 'Saída', 'Saldo', 'Total Integ. Anterior', 'Total Integ. Atual', 'Devedores'],
      ];

      // Adicionar divisões
      relatorioData.divisoes.forEach((div) => {
        sheet1Data.push([
          div.nome,
          div.entrada,
          div.saida,
          div.saldo,
          div.total_anterior,
          div.total_atual,
          div.devedores,
        ]);
      });

      // Total Regional
      sheet1Data.push([
        'TOTAL REGIONAL',
        relatorioData.totais.entrada,
        relatorioData.totais.saida,
        relatorioData.totais.saldo,
        relatorioData.totais.total_anterior,
        relatorioData.totais.total_atual,
        relatorioData.totais.devedores,
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      XLSX.utils.book_append_sheet(wb, ws1, 'Relatório Regional');

      // ===== SHEET 2: Estatísticas Especiais =====
      const sheet2Data: any[][] = [
        ['ESTATÍSTICAS ESPECIAIS'],
        [],
        ['VEÍCULOS'],
        ['Sem Veículo', relatorioData.totais.sem_veiculo],
        ['Com Moto', relatorioData.totais.com_moto],
        ['Com Carro', relatorioData.totais.com_carro],
      [],
      ['SGT ARMAS'],
      ['Divisão', 'Quantidade'],
    ];

    // Sgt Armas por divisão
    relatorioData.divisoes.forEach((div) => {
      sheet2Data.push([div.nome, div.sgt_armas]);
    });
    sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.sgt_armas]);
    
    sheet2Data.push([]);
    sheet2Data.push(['COMBATE INSANO']);
    sheet2Data.push(['Divisão', 'Quantidade']);
    
    // Combate Insano por divisão
    relatorioData.divisoes.forEach((div) => {
      sheet2Data.push([div.nome, div.combate_insano]);
    });
    sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.combate_insano]);
      
      sheet2Data.push([]);
      sheet2Data.push(['BATEDORES']);
      sheet2Data.push(['Divisão', 'Quantidade']);
      
      // Batedores por divisão
      relatorioData.divisoes.forEach((div) => {
        sheet2Data.push([div.nome, div.batedores]);
      });
      sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.batedores]);
      
      sheet2Data.push([]);
      sheet2Data.push(['CAVEIRAS']);
      sheet2Data.push(['Divisão', 'Titulares', 'Suplentes']);
      
      // Caveiras por divisão
      relatorioData.divisoes.forEach((div) => {
        sheet2Data.push([div.nome, div.caveiras, div.caveiras_suplentes]);
      });
      sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.caveiras, relatorioData.totais.caveiras_suplentes]);

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'Estatísticas Especiais');

      // Exportar arquivo
      const fileName = `relatorio_regional_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: `Relatório exportado: ${fileName}`,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao exportar relatório',
        variant: 'destructive',
      });
    }
  };

  // Loading de permissões
  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  // Loading de dados
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <p className="text-lg">Carregando relatório...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Relatório Regional</h1>
              {relatorioData?.dataCarga && (
                <p className="text-sm text-muted-foreground mt-1">
                  Última atualização: {formatarDataBrasil(relatorioData.dataCarga)}
                </p>
              )}
            </div>
            <Button onClick={handleExportExcel} variant="outline" size="sm" className="flex-shrink-0">
              <FileDown className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        {relatorioData && (
        <Tabs defaultValue="relatorio" className="w-full">
          <TabsList className={`grid w-full ${hasAccessSemanalAba ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução Histórica</TabsTrigger>
            <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
            <TabsTrigger value="afastamentos">Afastamentos</TabsTrigger>
            {hasAccessSemanalAba && (
              <TabsTrigger value="semanal">Rel. Semanal</TabsTrigger>
            )}
          </TabsList>
              
              <TabsContent value="relatorio">
                <div className="space-y-6">
                  <RelatorioTable
                    divisoes={relatorioData.divisoes}
                    totais={relatorioData.totais}
                    regionalNome="REGIONAL VALE DO PARAIBA I"
                  />
                  <EstatisticasEspeciais divisoes={relatorioData.divisoes} totais={relatorioData.totais} />
                </div>
              </TabsContent>
              
              <TabsContent value="evolucao">
                {isLoadingHistorico ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Carregando histórico...</p>
                    </CardContent>
                  </Card>
                ) : historicoData && historicoData.cargas.length >= 2 ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Evolução do Efetivo - Regional Vale do Paraíba I</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GraficoEvolucao 
                          cargas={historicoData.cargas} 
                          divisoesUnicas={historicoData.divisoesUnicas}
                        />
                      </CardContent>
                    </Card>
                    
                    <TabelaComparativa 
                      cargas={historicoData.cargas}
                      divisoesUnicas={historicoData.divisoesUnicas}
                    />
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Dados históricos insuficientes. São necessárias pelo menos 2 cargas para exibir a evolução.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="inadimplencia">
                <DashboardInadimplencia />
              </TabsContent>

              {/* Nova aba Afastamentos */}
              <TabsContent value="afastamentos">
                <Tabs defaultValue="ativos" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="ativos">Ativos</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                    <TabsTrigger value="retornos">Retornos Próximos</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  </TabsList>

                  {/* Sub-aba Ativos */}
                  <TabsContent value="ativos">
                    <Card>
                      <CardHeader>
                        <CardTitle>Afastamentos Ativos</CardTitle>
                        <CardDescription>
                          {totalAtivos} integrante(s) atualmente afastado(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loadingAtivos ? (
                          <p>Carregando...</p>
                        ) : ativos.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            Nenhum afastamento ativo no momento
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-3 text-muted-foreground">Número</th>
                                  <th className="text-left p-3 text-muted-foreground">Nome</th>
                                  <th className="text-left p-3 text-muted-foreground">Divisão</th>
                                  <th className="text-left p-3 text-muted-foreground">Tipo</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Afastamento</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Prevista</th>
                                  <th className="text-left p-3 text-muted-foreground">Dias Restantes</th>
                                  <th className="text-left p-3 text-muted-foreground">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ativos.map((afastado) => {
                                  const diasRestantes = getDiasRestantes(afastado.data_retorno_prevista);
                                  return (
                                    <tr key={afastado.id} className="border-b">
                                      <td className="p-3">{afastado.registro_id}</td>
                                      <td className="p-3 font-medium">{afastado.nome_colete}</td>
                                      <td className="p-3">{afastado.divisao_texto}</td>
                                      <td className="p-3">{afastado.tipo_afastamento}</td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {diasRestantes < 0 ? (
                                          <Badge variant="destructive">{Math.abs(diasRestantes)}d atrasado</Badge>
                                        ) : diasRestantes <= 7 ? (
                                          <Badge className="bg-orange-500">{diasRestantes}d</Badge>
                                        ) : (
                                          <Badge variant="secondary">{diasRestantes}d</Badge>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        {hasRole('admin') && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleRegistrarRetorno(afastado.id, afastado.nome_colete)}
                                          >
                                            Registrar Retorno
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sub-aba Histórico */}
                  <TabsContent value="historico">
                    <Card>
                      <CardHeader>
                        <CardTitle>Histórico de Afastamentos</CardTitle>
                        <CardDescription>
                          Todos os afastamentos registrados no sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loadingHistorico ? (
                          <p>Carregando...</p>
                        ) : historico.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            Nenhum registro encontrado
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-3 text-muted-foreground">Número</th>
                                  <th className="text-left p-3 text-muted-foreground">Nome</th>
                                  <th className="text-left p-3 text-muted-foreground">Divisão</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Afastamento</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Prevista</th>
                                  <th className="text-left p-3 text-muted-foreground">Dt. Retorno Efetivo</th>
                                  <th className="text-left p-3 text-muted-foreground">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historico.map((afastado) => {
                                  const statusRetorno = getStatusRetorno(afastado.data_retorno_prevista, afastado.data_retorno_efetivo);
                                  return (
                                    <tr key={afastado.id} className="border-b">
                                      <td className="p-3">{afastado.registro_id}</td>
                                      <td className="p-3 font-medium">{afastado.nome_colete}</td>
                                      <td className="p-3">{afastado.divisao_texto}</td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_afastamento), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                      </td>
                                      <td className="p-3">
                                        {afastado.data_retorno_efetivo
                                          ? format(new Date(afastado.data_retorno_efetivo), 'dd/MM/yyyy', { locale: ptBR })
                                          : '-'}
                                      </td>
                                      <td className="p-3">
                                        {afastado.ativo ? (
                                          <Badge>Ativo</Badge>
                                        ) : statusRetorno ? (
                                          <Badge variant={statusRetorno.variant}>{statusRetorno.label}</Badge>
                                        ) : (
                                          <Badge variant="secondary">Finalizado</Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Sub-aba Retornos Próximos */}
                  <TabsContent value="retornos">
                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Retornos nos Próximos 7 Dias</CardTitle>
                          <CardDescription>
                            Acompanhamento de retornos iminentes
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingProximos7 ? (
                            <p>Carregando...</p>
                          ) : proximos7.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              Nenhum retorno previsto para os próximos 7 dias
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {proximos7.map((afastado) => (
                                <div key={afastado.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <p className="font-medium">{afastado.nome_colete}</p>
                                    <p className="text-sm text-muted-foreground">{afastado.divisao_texto}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm">
                                      {format(new Date(afastado.data_retorno_prevista), 'dd/MM/yyyy', { locale: ptBR })}
                                    </p>
                                    <Badge className="bg-orange-500">
                                      {getDiasRestantes(afastado.data_retorno_prevista)} dias
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Retornos nos Próximos 30 Dias</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loadingProximos30 ? (
                            <p>Carregando...</p>
                          ) : (
                            <p className="text-2xl font-bold">{proximos30.length} retorno(s) previsto(s)</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Sub-aba Dashboard */}
                  <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Users className="h-8 w-8 text-primary" />
                            <div>
                              <div className="text-3xl font-bold">{totalAtivos}</div>
                              <p className="text-sm text-muted-foreground">Afastados Ativos</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-8 w-8 text-orange-500" />
                            <div>
                              <div className="text-3xl font-bold">{proximos7.length}</div>
                              <p className="text-sm text-muted-foreground">Retornos em 7 dias</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-blue-500" />
                            <div>
                              <div className="text-3xl font-bold">{proximos30.length}</div>
                              <p className="text-sm text-muted-foreground">Retornos em 30 dias</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                            <div>
                              <div className="text-3xl font-bold">{retornosAtrasados}</div>
                              <p className="text-sm text-muted-foreground">Retornos Atrasados</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Divisões Afetadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{divisoesAfetadas}</div>
                          <p className="text-sm text-muted-foreground">
                            divisão(ões) com integrantes afastados
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Total no Histórico</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{historico.length}</div>
                          <p className="text-sm text-muted-foreground">
                            afastamentos registrados (ativos e inativos)
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

            {hasAccessSemanalAba && (
              <TabsContent value="semanal">
                <RelatorioSemanalDivisaoAba />
              </TabsContent>
            )}
            </Tabs>
        )}

        {!relatorioData?.divisoes.length && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum dado disponível. Faça o upload de integrantes para gerar o relatório.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Relatorios;
