import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

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
  // Validação de segurança
  if (!cargas || cargas.length === 0 || !divisoesUnicas || divisoesUnicas.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Dados insuficientes para gerar o gráfico</div>;
  }

  // Criar mapeamento de divisões para números
  const divisoesMap = divisoesUnicas.reduce((acc, divisao, index) => {
    acc[divisao] = index + 1;
    return acc;
  }, {} as Record<string, number>);

  // Preparar dados para o gráfico com chaves numéricas
  const dadosGrafico = cargas.map(carga => {
    const mes = format(new Date(carga.data_carga), "MMM/yy", { locale: ptBR });
    const dados: any = { mes, total_regional: carga.total_integrantes };
    
    // Usar chaves numéricas para divisões
    carga.divisoes.forEach(divisao => {
      const numero = divisoesMap[divisao.divisao];
      if (numero) {
        dados[`divisao_${numero}`] = divisao.total;
      }
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
        `divisao_${index + 1}`,
        {
          label: `${index + 1}`,
          color: CORES_DIVISOES[index % CORES_DIVISOES.length],
        },
      ])
    ),
  };

  // Componente de legenda lateral
  const LegendaLateral = () => (
    <div className="ml-4 p-4 border rounded-lg bg-card max-h-[400px] overflow-y-auto min-w-[300px]">
      <h4 className="font-semibold mb-3 text-sm">Divisões</h4>
      <div className="space-y-2">
        {divisoesUnicas.map((divisao, index) => (
          <div key={divisao} className="flex items-start gap-2 text-xs">
            <span 
              className="font-bold min-w-[24px]"
              style={{ color: CORES_DIVISOES[index % CORES_DIVISOES.length] }}
            >
              {index + 1}.
            </span>
            <span className="text-muted-foreground leading-tight">{divisao}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4">
      {/* Gráfico principal */}
      <div className="flex-1">
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
              
              {/* Linhas das divisões com números */}
              {divisoesUnicas.map((divisao, index) => (
                <Line
                  key={divisao}
                  type="monotone"
                  dataKey={`divisao_${index + 1}`}
                  stroke={CORES_DIVISOES[index % CORES_DIVISOES.length]}
                  strokeWidth={1.5}
                  name={`${index + 1}`}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
      
      {/* Legenda lateral com nomes completos */}
      <LegendaLateral />
    </div>
  );
};
