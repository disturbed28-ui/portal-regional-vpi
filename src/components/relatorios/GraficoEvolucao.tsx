import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  // Estado para controlar qual visualização exibir
  const [visualizacao, setVisualizacao] = useState<string>('total');
  
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
    
    // Inicializar todas as divisões com null primeiro
    divisoesUnicas.forEach((_, index) => {
      dados[`divisao_${index + 1}`] = null;
    });
    
    // Preencher com dados reais onde existirem
    carga.divisoes.forEach(divisao => {
      // Normalizar o nome antes de buscar no mapa
      const nomeNormalizado = divisao.divisao
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      
      const numero = divisoesMap[nomeNormalizado];
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

  // Formatar nome de divisão para exibição
  const formatarNomeDivisao = (nome: string) => {
    return nome
      .replace('DIVISAO ', 'Divisão ')
      .replace('REGIONAL ', '');
  };

  // Renderizar linhas do gráfico baseado na seleção
  const renderizarLinhas = () => {
    // Se for "total", renderizar apenas Total Regional
    if (visualizacao === 'total') {
      return (
        <Line
          key="total_regional"
          type="monotone"
          dataKey="total_regional"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          name="Total Regional"
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      );
    }
    
    // Se for divisão específica, renderizar apenas a divisão
    const indexDivisao = divisoesUnicas.findIndex(d => d === visualizacao);
    if (indexDivisao !== -1) {
      return (
        <Line
          key={visualizacao}
          type="monotone"
          dataKey={`divisao_${indexDivisao + 1}`}
          stroke={CORES_DIVISOES[indexDivisao % CORES_DIVISOES.length]}
          strokeWidth={3}
          name={formatarNomeDivisao(visualizacao)}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          connectNulls={true}
        />
      );
    }
    
    return null;
  };


  return (
    <div className="space-y-4">
      {/* Filtro de visualização */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Visualizar:</label>
        <Select value={visualizacao} onValueChange={setVisualizacao}>
          <SelectTrigger className="w-[350px]">
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

      {/* Gráfico */}
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
            
            {/* Renderizar linhas dinamicamente */}
            {renderizarLinhas()}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
};
