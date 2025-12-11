import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Calendar, Users, MapPin, Eye, Filter, CalendarIcon, ChevronDown, Download } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcoesSociaisLista } from "@/hooks/useAcoesSociaisLista";
import { useDivisoes } from "@/hooks/useDivisoes";
import { exportAcoesSociaisToExcel } from "@/lib/exportAcoesSociaisExcel";
import { normalizarDivisao } from "@/lib/normalizeText";
import { getNivelAcesso } from "@/lib/grauUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function AcoesSociais() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/acoes-sociais', user?.id);
  const { hasRole, roles, loading: loadingRoles } = useUserRole(user?.id);

  // Determinar escopo de visualização
  const isAdmin = hasRole('admin');
  const grau = profile?.integrante?.grau || profile?.grau;
  const nivel = getNivelAcesso(grau);

  const escopoTexto = useMemo(() => {
    if (isAdmin || nivel === 'comando') {
      return 'Escopo: Comando (todas as ações)';
    }
    if (nivel === 'regional') {
      return `Escopo: Regional ${profile?.integrante?.regional_texto || ''}`;
    }
    return `Escopo: Divisão ${profile?.integrante?.divisao_texto || ''}`;
  }, [isAdmin, nivel, profile?.integrante?.regional_texto, profile?.integrante?.divisao_texto]);

  // Estados de filtro de período e divisão
  const hoje = new Date();
  const umMesAtras = subMonths(hoje, 1);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(umMesAtras);
  const [dataFim, setDataFim] = useState<Date | undefined>(hoje);
  const [divisaoFiltro, setDivisaoFiltro] = useState<string>('todas');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroStatusAcao, setFiltroStatusAcao] = useState<string | null>(null);

  // Buscar dados
  const { divisoes } = useDivisoes();
  const { registros, loading } = useAcoesSociaisLista({
    dataInicio,
    dataFim,
    divisaoId: divisaoFiltro === 'todas' ? undefined : divisaoFiltro,
  });

  const [registroSelecionado, setRegistroSelecionado] = useState<any>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [divisoesExpandidas, setDivisoesExpandidas] = useState<Set<string>>(new Set());

  // TODOS os useMemo ANTES dos early returns (regra de hooks)
  const registrosFiltrados = useMemo(() => {
    if (!registros) return [];
    let filtrados = registros;
    if (filtroStatusAcao) {
      filtrados = filtrados.filter(r => (r.status_acao || 'concluida') === filtroStatusAcao);
    }
    return filtrados;
  }, [registros, filtroStatusAcao]);

  const contagens = useMemo(() => ({
    todos: registros?.length || 0,
    em_andamento: registros?.filter(r => r.status_acao === 'em_andamento').length || 0,
    concluida: registros?.filter(r => !r.status_acao || r.status_acao === 'concluida').length || 0,
  }), [registros]);

  const registrosAgrupados = useMemo(() => {
    const grupos: Record<string, { nomeExibicao: string; registros: any[] }> = {};
    
    registrosFiltrados.forEach(registro => {
      const divisaoOriginal = registro.divisao_relatorio_texto || 'Sem Divisão';
      const chaveNormalizada = normalizarDivisao(divisaoOriginal);
      
      if (!grupos[chaveNormalizada]) {
        grupos[chaveNormalizada] = {
          nomeExibicao: divisaoOriginal,
          registros: []
        };
      } else {
        // Preferir o nome mais completo para exibição
        if (divisaoOriginal.length > grupos[chaveNormalizada].nomeExibicao.length) {
          grupos[chaveNormalizada].nomeExibicao = divisaoOriginal;
        }
      }
      grupos[chaveNormalizada].registros.push(registro);
    });

    return Object.values(grupos)
      .map(g => [g.nomeExibicao, g.registros] as [string, any[]])
      .sort(([a], [b]) => a.localeCompare(b));
  }, [registrosFiltrados]);

  // TODOS os useEffect ANTES dos early returns
  useEffect(() => {
    if (registrosAgrupados.length > 0 && registrosAgrupados.length <= 3 && divisoesExpandidas.size === 0) {
      setDivisoesExpandidas(new Set(registrosAgrupados.map(([divisao]) => divisao)));
    }
  }, [registrosAgrupados]);

  // Proteção de acesso - AGORA os early returns (depois de todos os hooks)
  if (loadingAccess || loadingRoles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    navigate('/');
    return null;
  }

  // Funções auxiliares (não são hooks, podem ficar depois dos returns)
  const handleVerDetalhes = (registro: any) => {
    setRegistroSelecionado(registro);
    setMostrarDetalhes(true);
  };

  const limparFiltros = () => {
    setDataInicio(subMonths(new Date(), 1));
    setDataFim(new Date());
    setDivisaoFiltro('todas');
    setFiltroStatusAcao(null);
  };

  const toggleDivisao = (divisao: string) => {
    setDivisoesExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(divisao)) {
        novo.delete(divisao);
      } else {
        novo.add(divisao);
      }
      return novo;
    });
  };

  const handleExportarExcel = () => {
    if (registrosFiltrados.length === 0) return;
    exportAcoesSociaisToExcel(registrosFiltrados);
  };

  const getStatusAcaoBadge = (status: string | null) => {
    if (status === 'em_andamento') {
      return (
        <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
          Em Andamento
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
        Concluída
      </Badge>
    );
  };

  const getEscopoBadge = (escopo: string) => {
    return escopo === 'externa' ? (
      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
        Externa
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
        Interna
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-full sm:max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-2xl font-bold">Ações Sociais</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Consulta e visualização</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">{escopoTexto}</p>
            </div>
          </div>
          
          {/* Ações do Header */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="h-8 px-3 text-xs sm:text-sm">
                {filtroStatusAcao ? `${registrosFiltrados.length}/${registros.length}` : registros.length} {registrosFiltrados.length === 1 ? 'ação' : 'ações'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="sm:hidden"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportarExcel}
              disabled={registrosFiltrados.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Filtros de Período e Divisão */}
        {(mostrarFiltros || typeof window !== 'undefined' && window.innerWidth >= 640) && (
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              {/* Linha 1: Datas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left text-xs sm:text-sm h-9">
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        {dataInicio ? format(dataInicio, 'dd/MM/yy', { locale: ptBR }) : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left text-xs sm:text-sm h-9">
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        {dataFim ? format(dataFim, 'dd/MM/yy', { locale: ptBR }) : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Linha 2: Divisão + Limpar */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={divisaoFiltro} onValueChange={setDivisaoFiltro}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Todas as divisões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as divisões</SelectItem>
                      {divisoes.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9 px-2 text-xs">
                  Limpar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Filtros de Status da Ação */}
        {!loading && registros.length > 0 && (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex gap-2 min-w-max sm:flex-wrap">
              <Button
                size="sm"
                variant={filtroStatusAcao === null ? 'default' : 'outline'}
                onClick={() => setFiltroStatusAcao(null)}
                className="text-xs sm:text-sm"
              >
                Todas ({contagens.todos})
              </Button>
              <Button
                size="sm"
                variant={filtroStatusAcao === 'em_andamento' ? 'default' : 'outline'}
                onClick={() => setFiltroStatusAcao('em_andamento')}
                className={`text-xs sm:text-sm ${filtroStatusAcao !== 'em_andamento' ? 'border-blue-500/50 text-blue-600 hover:bg-blue-500/10' : ''}`}
              >
                Em Andamento ({contagens.em_andamento})
              </Button>
              <Button
                size="sm"
                variant={filtroStatusAcao === 'concluida' ? 'default' : 'outline'}
                onClick={() => setFiltroStatusAcao('concluida')}
                className={`text-xs sm:text-sm ${filtroStatusAcao !== 'concluida' ? 'border-green-500/50 text-green-600 hover:bg-green-500/10' : ''}`}
              >
                Concluídas ({contagens.concluida})
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando ações sociais...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && registros.length === 0 && (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma ação social encontrada</h3>
            <p className="text-sm text-muted-foreground">
              Ainda não há ações sociais registradas para visualização.
            </p>
          </Card>
        )}

        {/* Empty State com Filtro */}
        {!loading && registros.length > 0 && registrosFiltrados.length === 0 && (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma ação com este status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não há ações sociais com o filtro selecionado.
            </p>
            <Button variant="outline" size="sm" onClick={() => setFiltroStatusAcao(null)}>
              Limpar Filtro
            </Button>
          </Card>
        )}

        {/* Lista Agrupada por Divisão */}
        {!loading && registrosAgrupados.length > 0 && (
          <div className="space-y-3">
            {registrosAgrupados.map(([divisao, registrosDivisao]) => (
              <Collapsible
                key={divisao}
                open={divisoesExpandidas.has(divisao)}
                onOpenChange={() => toggleDivisao(divisao)}
              >
                <CollapsibleTrigger asChild>
                  <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">{divisao}</CardTitle>
                          <Badge variant="secondary">{registrosDivisao.length}</Badge>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${divisoesExpandidas.has(divisao) ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-3 mt-2 pl-2">
                    {registrosDivisao.map((registro: any) => (
                      <Card key={registro.id} className="hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-2 px-3 sm:px-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary shrink-0" />
                              <CardTitle className="text-sm sm:text-base">
                                {new Date(registro.data_acao).toLocaleDateString('pt-BR')}
                              </CardTitle>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {getStatusAcaoBadge(registro.status_acao)}
                              {getEscopoBadge(registro.escopo_acao)}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 px-3 sm:px-6">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Heart className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{registro.tipo_acao_nome_snapshot}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs sm:text-sm">{registro.responsavel_nome_colete}</span>
                            </div>
                          </div>

                          <Separator />

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerDetalhes(registro)}
                            className="w-full text-xs sm:text-sm"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Ver Detalhes
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Modal de Detalhes */}
        <Dialog open={mostrarDetalhes} onOpenChange={setMostrarDetalhes}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Ação Social</DialogTitle>
            </DialogHeader>
            {registroSelecionado && (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted-foreground">Data da Ação:</span>
                      <p className="font-medium">
                        {new Date(registroSelecionado.data_acao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        {getStatusAcaoBadge(registroSelecionado.status_acao)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Tipo de Ação:</span>
                    <p className="font-medium">{registroSelecionado.tipo_acao_nome_snapshot}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Escopo:</span>
                    <div className="mt-1">
                      {getEscopoBadge(registroSelecionado.escopo_acao)}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Regional:</span>
                    <p className="font-medium">{registroSelecionado.regional_relatorio_texto}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Divisão:</span>
                    <p className="font-medium">{registroSelecionado.divisao_relatorio_texto}</p>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Responsável:</span>
                    <p className="font-medium">{registroSelecionado.responsavel_nome_colete}</p>
                  </div>

                  {registroSelecionado.responsavel_cargo_nome && (
                    <div>
                      <span className="text-muted-foreground">Cargo:</span>
                      <p className="font-medium">{registroSelecionado.responsavel_cargo_nome}</p>
                    </div>
                  )}

                  {registroSelecionado.descricao_acao && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-muted-foreground">Descrição:</span>
                        <p className="mt-1 whitespace-pre-wrap">{registroSelecionado.descricao_acao}</p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    <p>Criado em: {new Date(registroSelecionado.created_at).toLocaleString('pt-BR')}</p>
                    {registroSelecionado.origem_registro === 'importacao' && (
                      <p className="text-blue-500">Importado via Excel</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
