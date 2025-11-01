import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface DivisaoSnapshot {
  nome: string;
  total_atual: number;
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

const CORES_DIVISOES = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(340, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(150, 70%, 50%)',
  'hsl(180, 70%, 50%)',
  'hsl(240, 70%, 50%)',
  'hsl(300, 70%, 50%)',
  'hsl(60, 70%, 50%)',
];

export const GraficoEvolucao = ({ cargas, divisoesUnicas }: GraficoEvolucaoProps) => {
  // Preparar dados para o gráfico
  const dadosGrafico = cargas.map(carga => {
    const mes = format(new Date(carga.data_carga), "MMM/yy", { locale: ptBR });
    const dados: any = { mes, total_regional: carga.total_integrantes };
    
    // Adicionar dados de cada divisão
    carga.divisoes.forEach(divisao => {
      dados[divisao.nome] = divisao.total_atual;
    });
    
    return dados;
  });

  const chartConfig = {
    total_regional: {
      label: 'Total Regional',
      color: 'hsl(var(--primary))',
    },
    ...Object.fromEntries(
      divisoesUnicas.map((divisao, index) => [
        divisao,
        {
          label: divisao,
          color: CORES_DIVISOES[index % CORES_DIVISOES.length],
        },
      ])
    ),
  };

  return (
    <ChartContainer config={chartConfig} className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="mes" 
            className="text-xs"
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          
          {/* Linha do total regional - destaque */}
          <Line
            type="monotone"
            dataKey="total_regional"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            name="Total Regional"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          {/* Linhas das divisões */}
          {divisoesUnicas.map((divisao, index) => (
            <Line
              key={divisao}
              type="monotone"
              dataKey={divisao}
              stroke={CORES_DIVISOES[index % CORES_DIVISOES.length]}
              strokeWidth={1.5}
              name={divisao.length > 30 ? divisao.substring(0, 30) + '...' : divisao}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
