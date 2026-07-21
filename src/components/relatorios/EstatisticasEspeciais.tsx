import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DivisaoRelatorio, TotaisRelatorio } from '@/hooks/useRelatorioData';
import { Car, Bike, User, ShieldCheck, Swords, Skull, HardHat } from 'lucide-react';
import { LoboIcon } from '@/components/icons/LoboIcon';
import { UrsinhoIcon } from '@/components/icons/UrsinhoIcon';

interface EstatisticasEspeciaisProps {
  divisoes: DivisaoRelatorio[];
  totais: TotaisRelatorio;
}

const formatarNomes = (nomes: string[]) => {
  if (!nomes || nomes.length === 0) return '-';
  return nomes.join(', ');
};

interface TabelaSimplesProps {
  divisoes: DivisaoRelatorio[];
  totalRegional: number;
  campoNomes: keyof DivisaoRelatorio;
  campoQtd: keyof DivisaoRelatorio;
}

const TabelaNomesQuantidade = ({ divisoes, totalRegional, campoNomes, campoQtd }: TabelaSimplesProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Divisão</TableHead>
        <TableHead>Nomes</TableHead>
        <TableHead className="text-center whitespace-nowrap">Qtd</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {divisoes.map((divisao) => (
        <TableRow key={divisao.nome}>
          <TableCell className="align-top whitespace-nowrap">{divisao.nome}</TableCell>
          <TableCell className="align-top text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {formatarNomes(divisao[campoNomes] as string[])}
          </TableCell>
          <TableCell className="text-center font-medium align-top">
            {divisao[campoQtd] as number}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="bg-primary/10 font-bold">
        <TableCell className="text-muted-foreground">TOTAL REGIONAL</TableCell>
        <TableCell />
        <TableCell className="text-center text-muted-foreground">{totalRegional}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const EstatisticasEspeciais = ({ divisoes, totais }: EstatisticasEspeciaisProps) => {
  return (
    <div className="space-y-6 min-w-[300px]">
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
                <span className="text-sm font-medium text-muted-foreground">Sem Veículo</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totais.sem_veiculo}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bike className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Com Moto</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totais.com_moto}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Com Carro</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totais.com_carro}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sargento de Armas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Sargento de Armas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Agentes de Segurança Pública
          </div>
          <TabelaNomesQuantidade
            divisoes={divisoes}
            totalRegional={totais.sgt_armas}
            campoNomes="nomes_sgt_armas"
            campoQtd="sgt_armas"
          />
        </CardContent>
      </Card>

      {/* Combate Insano */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Combate Insano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Praticantes de Luta / Arte Marcial
          </div>
          <TabelaNomesQuantidade
            divisoes={divisoes}
            totalRegional={totais.combate_insano}
            campoNomes="nomes_combate_insano"
            campoQtd="combate_insano"
          />
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
          <TabelaNomesQuantidade
            divisoes={divisoes}
            totalRegional={totais.batedores}
            campoNomes="nomes_batedores"
            campoQtd="batedores"
          />
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
                <TableHead>
                  <div className="flex items-center gap-2">
                    <Skull className="h-4 w-4" />
                    Titulares
                  </div>
                </TableHead>
                <TableHead className="text-center whitespace-nowrap">Qtd</TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4" />
                    Suplentes
                  </div>
                </TableHead>
                <TableHead className="text-center whitespace-nowrap">Qtd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisoes.map((divisao) => (
                <TableRow key={divisao.nome}>
                  <TableCell className="align-top whitespace-nowrap">{divisao.nome}</TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {formatarNomes(divisao.nomes_caveiras)}
                  </TableCell>
                  <TableCell className="text-center font-medium align-top">{divisao.caveiras}</TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {formatarNomes(divisao.nomes_caveiras_suplentes)}
                  </TableCell>
                  <TableCell className="text-center font-medium align-top">{divisao.caveiras_suplentes}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-bold">
                <TableCell className="text-muted-foreground">TOTAL REGIONAL</TableCell>
                <TableCell />
                <TableCell className="text-center text-muted-foreground">{totais.caveiras}</TableCell>
                <TableCell />
                <TableCell className="text-center text-muted-foreground">{totais.caveiras_suplentes}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lobos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LoboIcon className="h-5 w-5" />
            Lobos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaNomesQuantidade
            divisoes={divisoes}
            totalRegional={totais.lobos}
            campoNomes="nomes_lobos"
            campoQtd="lobos"
          />
        </CardContent>
      </Card>

      {/* Ursinhos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UrsinhoIcon className="h-5 w-5" />
            Ursinhos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaNomesQuantidade
            divisoes={divisoes}
            totalRegional={totais.ursinhos}
            campoNomes="nomes_ursinhos"
            campoQtd="ursinhos"
          />
        </CardContent>
      </Card>
    </div>
  );
};
