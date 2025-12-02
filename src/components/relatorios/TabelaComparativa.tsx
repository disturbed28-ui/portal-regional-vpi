import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface DivisaoSnapshot {
  divisao: string;
  total: number;
}

interface CargaHistorica {
  data_carga: string;
  total_integrantes: number;
  divisoes: DivisaoSnapshot[];
}

interface TabelaComparativaProps {
  cargas: CargaHistorica[];
  divisoesUnicas: string[];
}

export const TabelaComparativa = ({ cargas, divisoesUnicas }: TabelaComparativaProps) => {
  // Validação de segurança
  if (!cargas || cargas.length === 0 || !divisoesUnicas || divisoesUnicas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Dados insuficientes para gerar a tabela comparativa
        </CardContent>
      </Card>
    );
  }

  // Preparar dados da tabela
  const linhasDivisoes = divisoesUnicas.map(nomeDivisao => {
    const valores = cargas.map(carga => {
      // Normalizar para comparação
      const divisao = carga.divisoes.find(d => {
        if (!d.divisao) return false;
        
        const nomeNormalizado = d.divisao
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        
        return nomeNormalizado === nomeDivisao;
      });
      
      return divisao?.total || 0;
    });
    
    const variacaoTotal = valores[valores.length - 1] - valores[0];
    
    // Formatar nome para exibição
    let nomeExibicao = nomeDivisao;
    if (nomeDivisao.startsWith('DIVISAO ')) {
      nomeExibicao = nomeDivisao.replace('DIVISAO ', 'Divisão ');
    }
    
    return {
      divisao: nomeExibicao,
      valores,
      variacaoTotal
    };
  });

  // Calcular totais regionais
  const totaisRegionais = cargas.map(carga => carga.total_integrantes);
  const variacaoTotalRegional = totaisRegionais[totaisRegionais.length - 1] - totaisRegionais[0];

  const renderIndicador = (valor: number) => {
    if (valor > 0) {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    } else if (valor < 0) {
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getCorVariacao = (valor: number) => {
    if (valor > 0) return 'text-green-600';
    if (valor < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-xs sm:text-sm sticky left-0 bg-background z-10">Divisão</TableHead>
                {cargas.map(carga => (
                  <TableHead key={carga.data_carga} className="text-center text-xs sm:text-sm whitespace-nowrap">
                    {format(new Date(carga.data_carga), "MMM/yy", { locale: ptBR })}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-xs sm:text-sm whitespace-nowrap">Var.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasDivisoes.map(linha => (
                <TableRow key={linha.divisao}>
                  <TableCell className="font-medium text-xs sm:text-sm sticky left-0 bg-background z-10">
                    {linha.divisao}
                  </TableCell>
                  {linha.valores.map((valor, index) => (
                    <TableCell key={index} className="text-center text-xs sm:text-sm">
                      {valor}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                      {renderIndicador(linha.variacaoTotal)}
                      <span className={`text-xs sm:text-sm ${getCorVariacao(linha.variacaoTotal)}`}>
                        {linha.variacaoTotal > 0 ? '+' : ''}{linha.variacaoTotal}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Linha de total regional */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="text-muted-foreground text-xs sm:text-sm sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                {totaisRegionais.map((total, index) => (
                  <TableCell key={index} className="text-center text-muted-foreground text-xs sm:text-sm">
                    {total}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                    {renderIndicador(variacaoTotalRegional)}
                    <span className={`text-xs sm:text-sm ${getCorVariacao(variacaoTotalRegional)}`}>
                      {variacaoTotalRegional > 0 ? '+' : ''}{variacaoTotalRegional}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
