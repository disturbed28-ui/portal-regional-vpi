import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CargaAfastados } from "@/components/admin/CargaAfastados";
import { useAfastadosAtivos, useAfastadosHistorico, useRetornosProximos, useRegistrarRetorno } from "@/hooks/useAfastados";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminAfastados() {
  const [activeTab, setActiveTab] = useState("nova-carga");
  const { afastados: ativos, loading: loadingAtivos, refetch: refetchAtivos } = useAfastadosAtivos();
  const { afastados: historico, loading: loadingHistorico } = useAfastadosHistorico();
  const { afastados: proximos7, loading: loadingProximos7 } = useRetornosProximos(7);
  const { afastados: proximos30, loading: loadingProximos30 } = useRetornosProximos(30);
  const { registrarRetorno } = useRegistrarRetorno();

  const handleRegistrarRetorno = async (afastadoId: string, nomeColete: string) => {
    try {
      await registrarRetorno(afastadoId);
      toast.success(`Retorno de ${nomeColete} registrado com sucesso!`);
      refetchAtivos();
    } catch (error) {
      toast.error('Erro ao registrar retorno');
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

  // Dashboard stats
  const totalAtivos = ativos.length;
  const retornosAtrasados = ativos.filter(a => getDiasRestantes(a.data_retorno_prevista) < 0).length;
  const divisoesAfetadas = new Set(ativos.map(a => a.divisao_texto)).size;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestão de Afastamentos</h1>
        <p className="text-muted-foreground">
          Controle de integrantes temporariamente afastados
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="nova-carga">Nova Carga</TabsTrigger>
          <TabsTrigger value="ativos">Afastados Ativos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="retornos">Retornos Próximos</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="nova-carga">
          <CargaAfastados />
        </TabsContent>

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
                        <th className="text-left p-3">Número</th>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">Divisão</th>
                        <th className="text-left p-3">Tipo</th>
                        <th className="text-left p-3">Dt. Afastamento</th>
                        <th className="text-left p-3">Dt. Retorno Prevista</th>
                        <th className="text-left p-3">Dias Restantes</th>
                        <th className="text-left p-3">Ações</th>
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
                              <Button
                                size="sm"
                                onClick={() => handleRegistrarRetorno(afastado.id, afastado.nome_colete)}
                              >
                                Registrar Retorno
                              </Button>
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
                        <th className="text-left p-3">Número</th>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">Divisão</th>
                        <th className="text-left p-3">Dt. Afastamento</th>
                        <th className="text-left p-3">Dt. Retorno Prevista</th>
                        <th className="text-left p-3">Dt. Retorno Efetivo</th>
                        <th className="text-left p-3">Status</th>
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
    </div>
  );
}
