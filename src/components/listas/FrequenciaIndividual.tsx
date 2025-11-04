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
import { Calendar as CalendarIcon, ChevronDown, Download, Filter } from "lucide-react";
import { format, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFrequenciaPonderada } from "@/hooks/useFrequenciaPonderada";
import { useDivisoes } from "@/hooks/useDivisoes";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface FrequenciaIndividualProps {
  isAdmin: boolean;
  userDivisaoId?: string;
}

type PeriodoPreset = 'ultimo_mes' | 'ultimos_3_meses' | 'ano_atual' | 'personalizado';

export const FrequenciaIndividual = ({ isAdmin, userDivisaoId }: FrequenciaIndividualProps) => {
  const hoje = new Date();
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('ultimo_mes');
  const [dataInicio, setDataInicio] = useState<Date>(subMonths(hoje, 1));
  const [dataFim, setDataFim] = useState<Date>(hoje);
  const [divisaoSelecionada, setDivisaoSelecionada] = useState<string>(userDivisaoId || 'todas');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { divisoes } = useDivisoes();

  const divisaoIds = useMemo(() => {
    if (divisaoSelecionada === 'todas') return undefined;
    return [divisaoSelecionada];
  }, [divisaoSelecionada]);

  const { data: dadosFrequencia, isLoading } = useFrequenciaPonderada({
    dataInicio,
    dataFim,
    divisaoIds,
  });

  const handlePeriodoChange = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset);
    const hoje = new Date();
    
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

  const getCorAproveitamento = (percentual: number) => {
    if (percentual >= 85) return 'bg-green-500';
    if (percentual >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
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

    const resumo = dadosFrequencia.map(i => ({
      'Nome': i.nome_colete,
      'Divisão': i.divisao,
      'Total Eventos': i.totalEventos,
      'Pontos Obtidos': i.pontosObtidos.toFixed(2),
      'Pontos Máximos': i.pontosMaximos.toFixed(2),
      'Aproveitamento %': i.percentual.toFixed(1),
    }));

    const detalhamento: any[] = [];
    dadosFrequencia.forEach(i => {
      i.eventos.forEach(e => {
        detalhamento.push({
          'Nome': i.nome_colete,
          'Divisão': i.divisao,
          'Evento': e.titulo,
          'Data': format(new Date(e.data), 'dd/MM/yyyy'),
          'Status': e.status,
          'Justificativa': e.justificativa || '-',
          'Peso Evento': e.pesoEvento.toFixed(2),
          'Peso Presença': e.pesoPresenca.toFixed(2),
          'Pontos': e.pontos.toFixed(2),
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    const wsDetalhamento = XLSX.utils.json_to_sheet(detalhamento);
    
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(wb, wsDetalhamento, 'Detalhamento');
    
    XLSX.writeFile(wb, `frequencia_individual_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

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
                        onSelect={(date) => date && setDataFim(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Divisão</label>
                <Select value={divisaoSelecionada} onValueChange={setDivisaoSelecionada}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {divisoes?.map(d => (
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

      <Card>
        <CardHeader>
          <CardTitle>Aproveitamento Individual</CardTitle>
        </CardHeader>
        <CardContent>
          {!dadosFrequencia || dadosFrequencia.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado encontrado para o período selecionado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Divisão</TableHead>
                  <TableHead className="text-center">Eventos</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                  <TableHead className="text-right">Máximo</TableHead>
                  <TableHead>Aproveitamento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosFrequencia.map((integrante) => (
                  <>
                    <TableRow key={integrante.integrante_id}>
                      <TableCell className="font-medium">{integrante.nome_colete}</TableCell>
                      <TableCell>{integrante.divisao}</TableCell>
                      <TableCell className="text-center">{integrante.totalEventos}</TableCell>
                      <TableCell className="text-right">{integrante.pontosObtidos.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{integrante.pontosMaximos.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={integrante.percentual} 
                              className="flex-1"
                            />
                            <Badge variant={getVariantAproveitamento(integrante.percentual)}>
                              {integrante.percentual.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
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
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="p-4 space-y-2">
                            <h4 className="font-medium text-sm mb-3">Detalhamento de Eventos</h4>
                            <div className="space-y-2">
                              {integrante.eventos.map((evento, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                                  <div className="flex-1">
                                    <div className="font-medium">{evento.titulo}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(evento.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={evento.status === 'presente' ? 'default' : 'secondary'}>
                                      {evento.status}
                                    </Badge>
                                    {evento.justificativa && (
                                      <Badge variant="outline">{evento.justificativa}</Badge>
                                    )}
                                    <div className="text-right">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};
