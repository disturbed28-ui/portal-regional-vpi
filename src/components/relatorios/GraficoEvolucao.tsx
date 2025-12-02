import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const COR_DIVISAO = 'hsl(210, 70%, 50%)'; // Azul para todas as divisões

export const GraficoEvolucao = ({ cargas, divisoesUnicas }: GraficoEvolucaoProps) => {
  // Estado para controlar qual visualização exibir
  const [visualizacao, setVisualizacao] = useState<string>('total');
  
  // Validação de segurança
  if (!cargas || cargas.length === 0 || !divisoesUnicas || divisoesUnicas.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Dados insuficientes para gerar o gráfico</div>;
  }

  // Processar apenas os dados necessários baseado na visualização selecionada
  const dadosGrafico = cargas.map(carga => {
    const mes = format(new Date(carga.data_carga), "MMM/yy", { locale: ptBR });
    
    // Caso 1: Total Regional
    if (visualizacao === 'total') {
      return {
        mes,
        total_regional: carga.total_integrantes
      };
    }
    
    // Caso 2: Divisão específica - processar apenas a divisão selecionada
    const divisaoSelecionada = carga.divisoes.find(div => {
      const nomeNormalizado = normalizarNomeDivisao(div.divisao);
      return nomeNormalizado === visualizacao;
    });
    
    return {
      mes,
      valor: divisaoSelecionada ? Number(divisaoSelecionada.total) : null
    };
  });

  // Formatar nome de divisão para exibição
  const formatarNomeDivisao = (nome: string) => {
    return nome
      .replace('DIVISAO ', 'Divisão ')
      .replace('REGIONAL ', '');
  };

  const chartConfig = visualizacao === 'total'
    ? {
        total_regional: {
          label: 'Total Regional',
          color: 'hsl(var(--primary))',
        }
      }
    : {
        valor: {
          label: formatarNomeDivisao(visualizacao),
          color: COR_DIVISAO,
        }
      };

  // Renderizar linha única baseada na seleção
  const renderizarLinhas = () => {
    if (visualizacao === 'total') {
      return (
        <Line
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
    
    return (
      <Line
        type="monotone"
        dataKey="valor"
        stroke={COR_DIVISAO}
        strokeWidth={3}
        name={formatarNomeDivisao(visualizacao)}
        dot={{ r: 4 }}
        activeDot={{ r: 6 }}
        connectNulls={true}
      />
    );
  };


  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filtro de visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <label className="text-xs sm:text-sm font-medium">Visualizar:</label>
        <Select value={visualizacao} onValueChange={setVisualizacao}>
          <SelectTrigger className="w-full sm:w-[350px]">
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
      <ChartContainer config={chartConfig} className="h-[250px] sm:h-[400px]">
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
