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
  console.log('[TabelaComparativa] Props recebidas:', { 
    cargasLength: cargas?.length,
    divisoesUnicasLength: divisoesUnicas?.length,
    divisoesUnicas,
    primeirasCargasDivisoes: cargas?.[0]?.divisoes
  });

  // Validação de segurança
  if (!cargas || cargas.length === 0 || !divisoesUnicas || divisoesUnicas.length === 0) {
    console.error('[TabelaComparativa] Dados inválidos recebidos');
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
        const divisao = carga.divisoes.find(d => d.divisao === nomeDivisao);
        return divisao?.total || 0;
      });
    
    const variacaoTotal = valores[valores.length - 1] - valores[0];
    
    return {
      divisao: nomeDivisao,
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Divisão</TableHead>
                {cargas.map(carga => (
                  <TableHead key={carga.data_carga} className="text-center">
                    {format(new Date(carga.data_carga), "MMM/yy", { locale: ptBR })}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasDivisoes.map(linha => (
                <TableRow key={linha.divisao}>
                  <TableCell className="font-medium text-sm">
                    {linha.divisao}
                  </TableCell>
                  {linha.valores.map((valor, index) => (
                    <TableCell key={index} className="text-center">
                      {valor}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {renderIndicador(linha.variacaoTotal)}
                      <span className={getCorVariacao(linha.variacaoTotal)}>
                        {linha.variacaoTotal > 0 ? '+' : ''}{linha.variacaoTotal}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Linha de total regional */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL REGIONAL</TableCell>
                {totaisRegionais.map((total, index) => (
                  <TableCell key={index} className="text-center">
                    {total}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {renderIndicador(variacaoTotalRegional)}
                    <span className={getCorVariacao(variacaoTotalRegional)}>
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
