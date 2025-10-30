import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DivisaoRelatorio, TotaisRelatorio } from '@/hooks/useRelatorioData';
import { Car, Bike, User, Shield, Skull, HardHat } from 'lucide-react';

interface EstatisticasEspeciaisProps {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
}

export const EstatisticasEspeciais = ({ divisoes, totais }: EstatisticasEspeciaisProps) => {
  return (
    <div className="space-y-6">
      {/* Veículos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Estatísticas de Veículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sem Veículo</span>
              </div>
              <p className="text-2xl font-bold">{totais.sem_veiculo}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bike className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Com Moto</span>
              </div>
              <p className="text-2xl font-bold">{totais.com_moto}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Com Carro</span>
              </div>
              <p className="text-2xl font-bold">{totais.com_carro}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Combate Insano */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Combate Insano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Divisão</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisoes.map((divisao) => (
                <TableRow key={divisao.nome}>
                  <TableCell>{divisao.nome}</TableCell>
                  <TableCell className="text-center font-medium">{divisao.combate_insano}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell>TOTAL REGIONAL</TableCell>
                <TableCell className="text-center">{totais.combate_insano}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Batedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" />
            Batedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Divisão</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisoes.map((divisao) => (
                <TableRow key={divisao.nome}>
                  <TableCell>{divisao.nome}</TableCell>
                  <TableCell className="text-center font-medium">{divisao.batedores}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell>TOTAL REGIONAL</TableCell>
                <TableCell className="text-center">{totais.batedores}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Caveiras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5" />
            Time de Caveiras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Divisão</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Skull className="h-4 w-4" />
                    Titulares
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <HardHat className="h-4 w-4" />
                    Suplentes
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisoes.map((divisao) => (
                <TableRow key={divisao.nome}>
                  <TableCell>{divisao.nome}</TableCell>
                  <TableCell className="text-center font-medium">{divisao.caveiras}</TableCell>
                  <TableCell className="text-center font-medium">{divisao.caveiras_suplentes}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell>TOTAL REGIONAL</TableCell>
                <TableCell className="text-center">{totais.caveiras}</TableCell>
                <TableCell className="text-center">{totais.caveiras_suplentes}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
