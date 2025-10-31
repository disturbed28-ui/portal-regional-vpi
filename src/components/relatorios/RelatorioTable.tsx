import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { DivisaoRelatorio, TotaisRelatorio } from '@/hooks/useRelatorioData';

interface RelatorioTableProps {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
  regionalNome?: string;
}

export const RelatorioTable = ({ divisoes, totais, regionalNome }: RelatorioTableProps) => {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="font-bold border-r border-border">DIVISÕES</TableHead>
              <TableHead className="text-center font-bold border-r border-border">Entrada</TableHead>
              <TableHead className="text-center font-bold border-r border-border">Saída</TableHead>
              <TableHead className="text-center font-bold border-r border-border">Saldo</TableHead>
              <TableHead className="text-center font-bold border-r border-border">Total Integ. Anterior</TableHead>
              <TableHead className="text-center font-bold border-r border-border">Total Integ. Atual</TableHead>
              <TableHead className="text-center font-bold">Devedores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divisoes.map((divisao, index) => (
              <TableRow key={divisao.nome} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                <TableCell className="font-medium border-r border-border">{divisao.nome}</TableCell>
                <TableCell className="text-center border-r border-border">{divisao.entrada}</TableCell>
                <TableCell className="text-center border-r border-border">{divisao.saida}</TableCell>
                <TableCell className="text-center border-r border-border">
                  <span className={divisao.saldo > 0 ? 'text-green-600' : divisao.saldo < 0 ? 'text-red-600' : ''}>
                    {divisao.saldo > 0 ? '+' : ''}{divisao.saldo}
                  </span>
                </TableCell>
                <TableCell className="text-center border-r border-border">{divisao.total_anterior}</TableCell>
                <TableCell className="text-center border-r border-border">{divisao.total_atual}</TableCell>
                <TableCell className="text-center">{divisao.devedores}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-primary/10 font-bold">
              <TableCell className="uppercase border-r border-border">
                {regionalNome || 'TOTAL GERAL'}
              </TableCell>
              <TableCell className="text-center border-r border-border">{totais.entrada}</TableCell>
              <TableCell className="text-center border-r border-border">{totais.saida}</TableCell>
              <TableCell className="text-center border-r border-border">
                <span className={totais.saldo > 0 ? 'text-green-600' : totais.saldo < 0 ? 'text-red-600' : ''}>
                  {totais.saldo > 0 ? '+' : ''}{totais.saldo}
                </span>
              </TableCell>
              <TableCell className="text-center border-r border-border">{totais.total_anterior}</TableCell>
              <TableCell className="text-center border-r border-border">{totais.total_atual}</TableCell>
              <TableCell className="text-center">{totais.devedores}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
