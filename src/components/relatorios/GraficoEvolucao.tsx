import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { normalizarNomeDivisao } from '@/lib/utils';

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
  const [visualizacao, setVisualizacao] = useState<string>('total');
  const [periodo, setPeriodo] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Filtrar cargas por período
  const cargasFiltradas = useMemo(() => {
    if (!cargas || cargas.length === 0) return [];

    if (periodo === 'todos') return cargas;

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

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="text-xs sm:text-sm font-medium shrink-0">Visualizar:</label>
          <Select value={visualizacao} onValueChange={setVisualizacao}>
            <SelectTrigger className="w-full sm:w-[280px]">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="text-xs sm:text-sm font-medium shrink-0">Período:</label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo o histórico</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
              <SelectItem value="ultimos_3">Últimos 3 meses</SelectItem>
              <SelectItem value="ultimos_6">Últimos 6 meses</SelectItem>
              <SelectItem value="ultimos_12">Últimos 12 meses</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === 'personalizado' && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal w-full sm:w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, 'MMM/yyyy', { locale: ptBR }) : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground text-center">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal w-full sm:w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, 'MMM/yyyy', { locale: ptBR }) : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Gráfico */}
      {cargasFiltradas.length < 1 ? (
        <div className="text-center text-muted-foreground py-8">Nenhum dado para o período selecionado</div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[280px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="mes"
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} iconType="line" />

              <Bar
                yAxisId="right"
                dataKey="entradas"
                fill={COR_ENTRADAS}
                name="Entradas"
                barSize={16}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="saidas"
                fill={COR_SAIDAS}
                name="Saídas"
                barSize={16}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                name={labelTotal}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
};
