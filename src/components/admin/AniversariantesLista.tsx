import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cake, Users } from 'lucide-react';
import { useAniversariantes } from '@/hooks/useAniversariantes';

interface AniversariantesListaProps {
  userId: string | undefined;
}

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
];

function formatDiaMes(dia: number, mes: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

function extrairNomeDivisao(divisaoTexto: string): string {
  // Remove "DIVISAO " e " - SP" para exibição mais limpa
  return divisaoTexto
    .replace(/^DIVISAO\s+/i, '')
    .replace(/\s+-\s+SP$/i, '')
    .trim();
}

export function AniversariantesLista({ userId }: AniversariantesListaProps) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null);
  
  const { aniversariantes, loading, error, totalCadastrados } = useAniversariantes(userId, {
    mesFiltro
  });

  const handleMesChange = (value: string) => {
    setMesFiltro(value === 'todos' ? null : parseInt(value, 10));
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Cake className="h-4 w-4" />
            Aniversariantes
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              <Users className="h-3 w-3 inline mr-1" />
              {totalCadastrados} cadastrados
            </span>
            <Select value={mesFiltro?.toString() || 'todos'} onValueChange={handleMesChange}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Filtrar mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {MESES.map(mes => (
                  <SelectItem key={mes.value} value={mes.value}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive text-sm">
            {error}
          </div>
        ) : aniversariantes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {totalCadastrados === 0 
              ? 'Nenhum aniversário cadastrado. Use o upload acima para importar.'
              : 'Nenhum aniversariante encontrado para o filtro selecionado.'
            }
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {aniversariantes.map(aniversariante => (
                <div
                  key={aniversariante.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {aniversariante.nome_colete}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {extrairNomeDivisao(aniversariante.divisao_texto)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <Cake className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {formatDiaMes(aniversariante.dia, aniversariante.mes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
