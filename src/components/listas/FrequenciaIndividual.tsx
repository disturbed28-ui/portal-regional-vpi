import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar as CalendarIcon, ChevronDown, Download, Users } from "lucide-react";
import { format, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFrequenciaPonderada, IntegranteFrequencia } from "@/hooks/useFrequenciaPonderada";
import { useDivisoes } from "@/hooks/useDivisoes";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";
import { useRegionais } from "@/hooks/useRegionais";
import { getNivelAcesso, romanToNumber } from "@/lib/grauUtils";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface FrequenciaIndividualProps {
  grau?: string | null;
  regionalId?: string | null;
  divisaoId?: string | null;
  isAdmin?: boolean;
}

type PeriodoPreset = 'ultimo_mes' | 'ultimos_3_meses' | 'ano_atual' | 'personalizado';

interface GrupoFrequencia {
  tipo: 'regional' | 'divisao';
  id: string;
  nome: string;
  integrantes: IntegranteFrequencia[];
}

export const FrequenciaIndividual = ({ grau, regionalId, divisaoId, isAdmin = false }: FrequenciaIndividualProps) => {
  const hoje = new Date();
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ultimo_mes');
  const [dataInicio, setDataInicio] = useState<Date>(subMonths(hoje, 1));
  const [dataFim, setDataFim] = useState<Date>(hoje);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string>('todas');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Determinar nível de acesso
  const nivelAcesso = getNivelAcesso(grau);

  // Buscar todas as divisões (para admin ou CMD)
  const { divisoes: todasDivisoes } = useDivisoes();
  
  // Buscar regionais
  const { regionais } = useRegionais();
  
  // Buscar divisões da regional (para graus V)
  const { divisoes: divisoesDaRegional, divisaoIds: divisaoIdsDaRegional } = useDivisoesPorRegional(
    nivelAcesso === 'regional' ? regionalId : null
  );

  // Determinar quais IDs de divisão usar para filtrar os dados
  const divisaoIdsParaFiltro = useMemo(() => {
    // Se uma divisão específica foi selecionada
    if (divisaoSelecionada && divisaoSelecionada !== 'todas') {
      return [divisaoSelecionada];
    }
    
    // Admin ou CMD: sem filtro (undefined = todos)
    if (isAdmin || nivelAcesso === 'comando') {
      return undefined;
    }
    
    // Grau VI (divisao): apenas a divisão do usuário
    if (nivelAcesso === 'divisao' && divisaoId) {
      return [divisaoId];
    }
    
    // Grau V (regional): todas as divisões da regional
    if (nivelAcesso === 'regional' && divisaoIdsDaRegional.length > 0) {
      return divisaoIdsDaRegional;
    }
    
    // Fallback
    return divisaoId ? [divisaoId] : undefined;
  }, [divisaoSelecionada, isAdmin, nivelAcesso, divisaoId, divisaoIdsDaRegional]);

  // Determinar quais divisões mostrar no seletor
  // IMPORTANTE: Priorizar nivelAcesso sobre isAdmin para que Grau V veja apenas divisões da sua regional
  const divisoesParaSelecao = useMemo(() => {
    // Grau VI: não mostrar seletor (apenas sua divisão)
    if (nivelAcesso === 'divisao') {
      return [];
    }
    
    // Grau V (Regional): apenas divisões da sua regional (independente de role admin)
    if (nivelAcesso === 'regional') {
      return divisoesDaRegional;
    }
    
    // CMD (Graus I-IV) ou Admin sem grau definido: todas as divisões
    if (isAdmin || nivelAcesso === 'comando') {
      return todasDivisoes || [];
    }
    
    return [];
  }, [nivelAcesso, isAdmin, todasDivisoes, divisoesDaRegional]);

  const { data: dadosFrequencia, isLoading } = useFrequenciaPonderada({
    dataInicio,
    dataFim,
    divisaoIds: divisaoIdsParaFiltro,
  });

  // Agrupar dados conforme nível de acesso (mesmo padrão do IntegrantesTab/useIntegrantesRelatorio)
  const dadosAgrupados = useMemo((): GrupoFrequencia[] => {
    if (!dadosFrequencia || !regionais || !todasDivisoes) return [];

    const grupos: GrupoFrequencia[] = [];

    // CMD (Graus I-IV) ou Admin: agrupar por Regional/Divisão
    if (isAdmin || nivelAcesso === 'comando') {
      regionais.forEach(regional => {
        // Integrantes que estão na Regional (divisao_texto === regional_texto)
        const integrantesRegional = dadosFrequencia.filter(
          i => i.regional_id === regional.id && i.divisao === i.regional_texto
        );

        if (integrantesRegional.length > 0) {
          grupos.push({
            tipo: 'regional',
            id: regional.id,
            nome: regional.nome,
            integrantes: integrantesRegional
          });
        }

        // Divisões dessa regional
        const divisoesRegional = todasDivisoes.filter(d => d.regional_id === regional.id);
        divisoesRegional.forEach(divisao => {
          const integrantesDivisao = dadosFrequencia.filter(
            i => i.divisao_id === divisao.id && i.divisao !== i.regional_texto
          );

          if (integrantesDivisao.length > 0) {
            grupos.push({
              tipo: 'divisao',
              id: divisao.id,
              nome: divisao.nome,
              integrantes: integrantesDivisao
            });
          }
        });
      });

      return grupos;
    }

    // Grau V (Regional): agrupar por divisão dentro da regional
    if (nivelAcesso === 'regional') {
      // Primeiro bloco: integrantes diretos da Regional
      const integrantesRegional = dadosFrequencia.filter(
        i => i.divisao === i.regional_texto
      );

      if (integrantesRegional.length > 0) {
        const regionalNome = integrantesRegional[0]?.regional_texto || 'Regional';
        grupos.push({
          tipo: 'regional',
          id: regionalId || 'regional',
          nome: regionalNome,
          integrantes: integrantesRegional
        });
      }

      // Agrupar por divisão
      const gruposPorDivisao = new Map<string, IntegranteFrequencia[]>();
      
      dadosFrequencia.forEach(integrante => {
        if (integrante.divisao === integrante.regional_texto) return; // Já está no bloco da regional
        
        const divisaoNome = integrante.divisao || 'Sem Divisão';
        const divisaoIdKey = integrante.divisao_id || divisaoNome;
        
        if (!gruposPorDivisao.has(divisaoIdKey)) {
          gruposPorDivisao.set(divisaoIdKey, []);
        }
        gruposPorDivisao.get(divisaoIdKey)!.push(integrante);
      });

      gruposPorDivisao.forEach((integrantes, divisaoIdKey) => {
        const divisaoNome = integrantes[0]?.divisao || 'Sem Divisão';
        grupos.push({
          tipo: 'divisao',
          id: divisaoIdKey,
          nome: divisaoNome,
          integrantes
        });
      });

      // Ordenar divisões por nome
      grupos.sort((a, b) => {
        if (a.tipo === 'regional') return -1;
        if (b.tipo === 'regional') return 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      return grupos;
    }

    // Grau VI (Divisão): agrupar pela divisão (normalmente será apenas uma)
    if (nivelAcesso === 'divisao') {
      const gruposPorDivisao = new Map<string, IntegranteFrequencia[]>();
      
      dadosFrequencia.forEach(integrante => {
        const divisaoNome = integrante.divisao || 'Sem Divisão';
        const divisaoIdKey = integrante.divisao_id || divisaoNome;
        
        if (!gruposPorDivisao.has(divisaoIdKey)) {
          gruposPorDivisao.set(divisaoIdKey, []);
        }
        gruposPorDivisao.get(divisaoIdKey)!.push(integrante);
      });

      gruposPorDivisao.forEach((integrantes, divisaoIdKey) => {
        const divisaoNome = integrantes[0]?.divisao || 'Sem Divisão';
        grupos.push({
          tipo: 'divisao',
          id: divisaoIdKey,
          nome: divisaoNome,
          integrantes
        });
      });

      return grupos;
    }

    return [{ tipo: 'divisao', id: 'geral', nome: 'Geral', integrantes: dadosFrequencia }];
  }, [dadosFrequencia, isAdmin, nivelAcesso, regionais, todasDivisoes, regionalId]);

  const handlePeriodoChange = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    switch (preset) {
      case 'ultimo_mes':
        setDataInicio(subMonths(hoje, 1));
        setDataFim(hoje);
        break;
      case 'ultimos_3_meses':
        setDataInicio(subMonths(hoje, 3));
        setDataFim(hoje);
        break;
      case 'ano_atual':
        setDataInicio(startOfYear(hoje));
        setDataFim(hoje);
        break;
    }
  };

  const getVariantAproveitamento = (percentual: number) => {
    if (percentual >= 85) return 'default' as const;
    if (percentual >= 50) return 'secondary' as const;
    return 'destructive' as const;
  };

  const toggleRow = (integranteId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(integranteId)) {
        next.delete(integranteId);
      } else {
        next.add(integranteId);
      }
      return next;
    });
  };

  const handleExportExcel = () => {
    if (!dadosFrequencia) return;

    const getStatusOrder = (status: string): number => {
      switch (status) {
        case 'presente': return 1;
        case 'visitante': return 2;
        case 'ausente': return 3;
        case 'justificado': return 4;
        default: return 999;
      }
    };

    // Agrupar eventos por data/título
    const eventosPorData = new Map<string, {
      data: string;
      titulo: string;
      integrantes: Array<{
        nome: string;
        divisao: string;
        regional: string;
        cargo: string;
        grau: string;
        status: string;
        justificativa: string;
        peso_evento: number;
        peso_presenca: number;
        pontos: number;
        tipo_grupo: 'regional' | 'divisao';
        grupo_nome: string;
      }>;
    }>();

    // Usar dadosAgrupados para manter a estrutura de grupos
    dadosAgrupados.forEach(grupo => {
      grupo.integrantes.forEach(integrante => {
        integrante.eventos.forEach(evento => {
          const eventoKey = `${evento.data}|${evento.titulo}`;
          
          if (!eventosPorData.has(eventoKey)) {
            eventosPorData.set(eventoKey, {
              data: evento.data,
              titulo: evento.titulo,
              integrantes: []
            });
          }
          
          const eventoData = eventosPorData.get(eventoKey)!;
          eventoData.integrantes.push({
            nome: integrante.nome_colete,
            divisao: integrante.divisao,
            regional: integrante.regional_texto || '',
            cargo: evento.cargo_nome || '-',
            grau: evento.grau || '-',
            status: evento.status,
            justificativa: evento.justificativa || '-',
            peso_evento: evento.pesoEvento,
            peso_presenca: evento.pesoPresenca,
            pontos: evento.pontos,
            tipo_grupo: grupo.tipo,
            grupo_nome: grupo.nome
          });
        });
      });
    });

    const eventosOrdenados = Array.from(eventosPorData.values())
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    const dadosParaExcel: any[] = [];
    
    eventosOrdenados.forEach(evento => {
      // Cabeçalho do evento
      dadosParaExcel.push({
        'Data': format(new Date(evento.data), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Evento': evento.titulo,
        'Grupo': '',
        'Nome': '',
        'Divisão': '',
        'Cargo': '',
        'Grau': '',
        'Status': '',
        'Justificativa': '',
        'Peso Evento': '',
        'Peso Presença': '',
        'Pontos': ''
      });

      // Agrupar integrantes do evento por grupo (regional/divisão)
      const integrantesPorGrupo = new Map<string, typeof evento.integrantes>();
      evento.integrantes.forEach(int => {
        const grupoKey = `${int.tipo_grupo}|${int.grupo_nome}`;
        if (!integrantesPorGrupo.has(grupoKey)) {
          integrantesPorGrupo.set(grupoKey, []);
        }
        integrantesPorGrupo.get(grupoKey)!.push(int);
      });

      // Ordenar grupos: regionais primeiro, depois divisões alfabeticamente
      const gruposOrdenados = Array.from(integrantesPorGrupo.entries()).sort((a, b) => {
        const [tipoA] = a[0].split('|');
        const [tipoB] = b[0].split('|');
        if (tipoA === 'regional' && tipoB !== 'regional') return -1;
        if (tipoA !== 'regional' && tipoB === 'regional') return 1;
        return a[0].localeCompare(b[0], 'pt-BR');
      });

      gruposOrdenados.forEach(([grupoKey, integrantes]) => {
        const [tipoGrupo, grupoNome] = grupoKey.split('|');
        const separador = tipoGrupo === 'regional' ? '═══' : '──';
        
        // Separador de grupo
        dadosParaExcel.push({
          'Data': '',
          'Evento': '',
          'Grupo': `${separador} ${grupoNome} ${separador}`,
          'Nome': '',
          'Divisão': '',
          'Cargo': '',
          'Grau': '',
          'Status': '',
          'Justificativa': '',
          'Peso Evento': '',
          'Peso Presença': '',
          'Pontos': ''
        });

        // Ordenar integrantes
        const integrantesOrdenados = [...integrantes].sort((a, b) => {
          const statusA = getStatusOrder(a.status);
          const statusB = getStatusOrder(b.status);
          if (statusA !== statusB) return statusA - statusB;
          
          const grauA = romanToNumber(a.grau);
          const grauB = romanToNumber(b.grau);
          if (grauA !== grauB) return grauA - grauB;
          
          return a.nome.localeCompare(b.nome, 'pt-BR');
        });

        integrantesOrdenados.forEach(int => {
          dadosParaExcel.push({
            'Data': '',
            'Evento': '',
            'Grupo': '',
            'Nome': int.nome,
            'Divisão': int.divisao,
            'Cargo': int.cargo,
            'Grau': int.grau,
            'Status': int.status,
            'Justificativa': int.justificativa,
            'Peso Evento': int.peso_evento.toFixed(2),
            'Peso Presença': int.peso_presenca.toFixed(2),
            'Pontos': int.pontos.toFixed(2)
          });
        });

        // Total do grupo
        dadosParaExcel.push({
          'Data': '',
          'Evento': '',
          'Grupo': `Total ${grupoNome}: ${integrantes.length}`,
          'Nome': '',
          'Divisão': '',
          'Cargo': '',
          'Grau': '',
          'Status': '',
          'Justificativa': '',
          'Peso Evento': '',
          'Peso Presença': '',
          'Pontos': ''
        });
      });

      // Linha em branco entre eventos
      dadosParaExcel.push({
        'Data': '', 'Evento': '', 'Grupo': '', 'Nome': '', 'Divisão': '', 'Cargo': '', 
        'Grau': '', 'Status': '', 'Justificativa': '', 'Peso Evento': '', 
        'Peso Presença': '', 'Pontos': ''
      });
    });

    // Total Geral
    dadosParaExcel.push({
      'Data': 'TOTAL GERAL',
      'Evento': `${dadosFrequencia.length} integrantes`,
      'Grupo': '',
      'Nome': '',
      'Divisão': '',
      'Cargo': '',
      'Grau': '',
      'Status': '',
      'Justificativa': '',
      'Peso Evento': '',
      'Peso Presença': '',
      'Pontos': ''
    });

    const ws = XLSX.utils.json_to_sheet(dadosParaExcel);
    
    ws['!cols'] = [
      { wch: 18 }, { wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 30 },
      { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Frequência por Evento');
    
    XLSX.writeFile(wb, `frequencia_por_evento_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  const totalGeral = dadosFrequencia?.length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={periodoPreset} onValueChange={(v) => handlePeriodoChange(v as PeriodoPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultimo_mes">Último Mês</SelectItem>
                  <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ano_atual">Ano Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodoPreset === 'personalizado' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Início</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={(date) => date && setDataInicio(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={(date) => {
                          if (date) {
                            const hoje = new Date();
                            hoje.setHours(23, 59, 59, 999);
                            setDataFim(date > hoje ? hoje : date);
                          }
                        }}
                        locale={ptBR}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* Mostrar seletor de divisão apenas se houver opções */}
            {divisoesParaSelecao.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Divisão</label>
                <Select value={divisaoSelecionada} onValueChange={setDivisaoSelecionada}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {divisoesParaSelecao.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleExportExcel} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exibir dados agrupados - Padrão IntegrantesTab */}
      {dadosAgrupados.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Nenhum dado encontrado para o período selecionado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dadosAgrupados.map((grupo) => (
            <div key={grupo.id} className="space-y-2">
              {/* Cabeçalho do Grupo - estilo IntegrantesTab */}
              <div className="flex items-center gap-2 px-1">
                {grupo.tipo === 'regional' && <div className="flex-1 h-px bg-border" />}
                <h3 className={`text-xs sm:text-sm font-semibold ${
                  grupo.tipo === 'regional' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}>
                  {grupo.tipo === 'regional' ? '═══ ' : '── '}
                  {grupo.nome}
                  {grupo.tipo === 'regional' ? ' ═══' : ' ──'}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Tabela de integrantes */}
              {grupo.integrantes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhum dado encontrado
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Nome</TableHead>
                        <TableHead className="hidden md:table-cell">Divisão</TableHead>
                        <TableHead className="text-center">Eventos</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Pontos</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Máximo</TableHead>
                        <TableHead className="min-w-[140px]">Aproveitamento</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.integrantes.map((integrante) => (
                        <>
                          <TableRow key={integrante.integrante_id}>
                            <TableCell className="font-medium text-sm">{integrante.nome_colete}</TableCell>
                            <TableCell className="hidden md:table-cell">{integrante.divisao}</TableCell>
                            <TableCell className="text-center">{integrante.totalEventos}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">{integrante.pontosObtidos.toFixed(2)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">{integrante.pontosMaximos.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={integrante.percentual} 
                                  className="flex-1 min-w-[60px]"
                                />
                                <Badge variant={getVariantAproveitamento(integrante.percentual)} className="text-xs">
                                  {integrante.percentual.toFixed(1)}%
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => toggleRow(integrante.integrante_id)}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    expandedRows.has(integrante.integrante_id) && "rotate-180"
                                  )}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {expandedRows.has(integrante.integrante_id) && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/50 p-0">
                                <div className="p-3 md:p-4 space-y-2">
                                  <h4 className="font-medium text-sm mb-3 text-muted-foreground">Detalhamento de Eventos</h4>
                                  <div className="space-y-2">
                                    {integrante.eventos.map((evento, idx) => (
                                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm p-2 bg-background rounded border gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{evento.titulo}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {format(new Date(evento.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant={evento.status === 'presente' ? 'default' : 'secondary'} className="text-xs">
                                            {evento.status}
                                          </Badge>
                                          {evento.justificativa && (
                                            <Badge variant="outline" className="text-xs">{evento.justificativa}</Badge>
                                          )}
                                          <div className="text-right ml-auto sm:ml-0">
                                            <div className="text-xs text-muted-foreground">
                                              Peso: {evento.pesoEvento.toFixed(2)} × {evento.pesoPresenca.toFixed(2)}
                                            </div>
                                            <div className="font-medium">
                                              {evento.pontos.toFixed(2)} pts
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Total do Bloco - estilo IntegrantesTab */}
              <div className="flex items-center justify-end px-2 py-1">
                <span className="text-xs font-semibold text-foreground">
                  Total {grupo.nome}: {grupo.integrantes.length} {grupo.integrantes.length === 1 ? 'integrante' : 'integrantes'}
                </span>
              </div>
            </div>
          ))}

          {/* Total Geral - estilo IntegrantesTab */}
          <div className="flex items-center justify-center px-2 py-3 mt-4 border-t">
            <span className="text-sm font-bold text-foreground">
              Total Geral: {totalGeral} {totalGeral === 1 ? 'integrante' : 'integrantes'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
