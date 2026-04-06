import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { normalizarNomeDivisao } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface DivisaoSnapshot {
  divisao: string;
  total: number;
}

interface CargaHistorica {
  data_carga: string;
  total_integrantes: number;
  divisoes: DivisaoSnapshot[];
}

interface GraficoEvolucaoProps {
  cargas: CargaHistorica[];
  divisoesUnicas: string[];
}

const COR_ENTRADAS = 'hsl(142, 71%, 45%)';
const COR_SAIDAS = 'hsl(0, 84%, 60%)';

export const GraficoEvolucao = ({ cargas, divisoesUnicas }: GraficoEvolucaoProps) => {
  const isMobile = useIsMobile();
  const [visualizacao, setVisualizacao] = useState<string>('total');
  const [periodo, setPeriodo] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Filtrar cargas por período
  const cargasFiltradas = useMemo(() => {
    if (!cargas || cargas.length === 0) return [];

    if (periodo === 'todos') return cargas || [];

    let inicio: Date;
    let fim: Date;

    if (periodo === 'mes_atual') {
      inicio = startOfMonth(new Date());
      fim = endOfMonth(new Date());
    } else if (periodo === 'ultimos_3') {
      inicio = startOfMonth(subMonths(new Date(), 2));
      fim = endOfMonth(new Date());
    } else if (periodo === 'ultimos_6') {
      inicio = startOfMonth(subMonths(new Date(), 5));
      fim = endOfMonth(new Date());
    } else if (periodo === 'ultimos_12') {
      inicio = startOfMonth(subMonths(new Date(), 11));
      fim = endOfMonth(new Date());
    } else if (periodo === 'personalizado') {
      if (!dataInicio || !dataFim) return cargas;
      inicio = dataInicio;
      fim = endOfMonth(dataFim);
    } else {
      return cargas;
    }

    return cargas.filter(c => {
      const d = parseISO(c.data_carga);
      return isWithinInterval(d, { start: inicio, end: fim });
    });
  }, [cargas, periodo, dataInicio, dataFim]);

  // Processar dados do gráfico com entradas e saídas
  const dadosGrafico = useMemo(() => {
    return cargasFiltradas.map((carga, index) => {
      const mes = format(parseISO(carga.data_carga), "MMM/yy", { locale: ptBR });

      let totalAtual: number;
      let totalAnterior: number | null = null;

      if (visualizacao === 'total') {
        totalAtual = carga.total_integrantes;
        if (index > 0) {
          totalAnterior = cargasFiltradas[index - 1].total_integrantes;
        }
      } else {
        const div = carga.divisoes.find(d => normalizarNomeDivisao(d.divisao) === visualizacao);
        totalAtual = div ? Number(div.total) : 0;
        if (index > 0) {
          const divAnt = cargasFiltradas[index - 1].divisoes.find(d => normalizarNomeDivisao(d.divisao) === visualizacao);
          totalAnterior = divAnt ? Number(divAnt.total) : 0;
        }
      }

      let entradas = 0;
      let saidas = 0;

      if (totalAnterior !== null) {
        const diff = totalAtual - totalAnterior;
        if (diff > 0) {
          entradas = diff;
        } else if (diff < 0) {
          saidas = Math.abs(diff);
        }
      }

      return { mes, total: totalAtual, entradas, saidas };
    });
  }, [cargasFiltradas, visualizacao]);

  if (!cargas || cargas.length === 0 || !divisoesUnicas || divisoesUnicas.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Dados insuficientes para gerar o gráfico</div>;
  }

  const formatarNomeDivisao = (nome: string) => {
    return nome
      .replace('DIVISAO ', 'Divisão ')
      .replace('REGIONAL ', '');
  };

  const labelTotal = visualizacao === 'total' ? 'Total Regional' : formatarNomeDivisao(visualizacao);

  const chartConfig = {
    total: {
      label: labelTotal,
      color: 'hsl(var(--primary))',
    },
    entradas: {
      label: 'Entradas',
      color: COR_ENTRADAS,
    },
    saidas: {
      label: 'Saídas',
      color: COR_SAIDAS,
    },
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-2 shadow-md text-xs">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Filtros compactos */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] sm:text-xs font-medium text-muted-foreground">Visualizar</label>
          <Select value={visualizacao} onValueChange={setVisualizacao}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Total Regional</SelectItem>
              {divisoesUnicas.map((divisao) => (
                <SelectItem key={divisao} value={divisao}>
                  {formatarNomeDivisao(divisao)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] sm:text-xs font-medium text-muted-foreground">Período</label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo histórico</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
              <SelectItem value="ultimos_3">Últimos 3 meses</SelectItem>
              <SelectItem value="ultimos_6">Últimos 6 meses</SelectItem>
              <SelectItem value="ultimos_12">Últimos 12 meses</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {periodo === 'personalizado' && (
        <div className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 justify-start font-normal">
                <CalendarIcon className="mr-1 h-3 w-3" />
                {dataInicio ? format(dataInicio, 'MMM/yy', { locale: ptBR }) : 'Início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} />
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 justify-start font-normal">
                <CalendarIcon className="mr-1 h-3 w-3" />
                {dataFim ? format(dataFim, 'MMM/yy', { locale: ptBR }) : 'Fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataFim} onSelect={setDataFim} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Gráfico */}
      {cargasFiltradas.length < 1 ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Nenhum dado para o período selecionado</div>
      ) : (
        <div className={isMobile ? "overflow-x-auto -mx-2 px-2" : ""}>
          <div style={isMobile ? { minWidth: Math.max(dadosGrafico.length * 56, 320) } : undefined}>
            <ChartContainer config={chartConfig} className="h-[240px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosGrafico} margin={isMobile ? { top: 5, right: 5, left: -15, bottom: 0 } : undefined}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: isMobile ? 9 : 11 }}
                    interval={isMobile ? 'preserveStartEnd' : 0}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 40 : 30}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: isMobile ? 9 : 11 }}
                    width={isMobile ? 30 : 40}
                  />
                  {!isMobile && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: isMobile ? '9px' : '11px' }}
                    iconSize={isMobile ? 8 : 14}
                    iconType="line"
                  />

                  <Bar
                    yAxisId={isMobile ? "left" : "right"}
                    dataKey="entradas"
                    fill={COR_ENTRADAS}
                    name="Entradas"
                    barSize={isMobile ? 10 : 16}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    yAxisId={isMobile ? "left" : "right"}
                    dataKey="saidas"
                    fill={COR_SAIDAS}
                    name="Saídas"
                    barSize={isMobile ? 10 : 16}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={isMobile ? 2 : 3}
                    name={labelTotal}
                    dot={{ r: isMobile ? 2 : 3 }}
                    activeDot={{ r: isMobile ? 3 : 5 }}
                    connectNulls={true}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      )}
    </div>
  );
};
