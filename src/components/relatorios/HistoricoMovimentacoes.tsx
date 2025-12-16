import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, ArrowRightLeft, ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMovimentacoesComFiltro } from '@/hooks/useMovimentacoesIntegrantes';

interface HistoricoMovimentacoesProps {
  nivelAcesso: 'comando' | 'regional' | 'divisao';
  regionalUsuario?: string;
  divisaoUsuario?: string;
}

const TIPOS_MOVIMENTACAO = [
  { value: 'TODOS', label: 'Todos os tipos' },
  { value: 'MUDANCA_DIVISAO', label: '📦 Mudança de Divisão' },
  { value: 'MUDANCA_REGIONAL', label: '🌎 Mudança de Regional' },
  { value: 'INATIVACAO', label: '🔴 Inativação' },
  { value: 'REATIVACAO', label: '🟢 Reativação' },
];

const ITEMS_PER_PAGE = 50;

export const HistoricoMovimentacoes = ({
  nivelAcesso,
  regionalUsuario,
  divisaoUsuario
}: HistoricoMovimentacoesProps) => {
  const [buscaNome, setBuscaNome] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [pagina, setPagina] = useState(1);

  // Determinar filtros baseado no nível de acesso
  const filtroIntegrantesDivisao = nivelAcesso === 'divisao' ? divisaoUsuario : undefined;
  const filtroIntegrantesRegional = nivelAcesso === 'regional' ? regionalUsuario : undefined;

  const { data: movimentacoes, isLoading, refetch } = useMovimentacoesComFiltro({
    integrantesDaDivisao: filtroIntegrantesDivisao,
    integrantesDaRegional: filtroIntegrantesRegional,
    tipos: tipoFiltro !== 'TODOS' ? [tipoFiltro] : undefined,
  });

  // Filtrar por nome localmente
  const movimentacoesFiltradas = useMemo(() => {
    if (!movimentacoes) return [];
    
    let resultado = movimentacoes;
    
    if (buscaNome.trim()) {
      const termo = buscaNome.toLowerCase();
      resultado = resultado.filter(m => 
        m.nome_colete.toLowerCase().includes(termo)
      );
    }
    
    return resultado;
  }, [movimentacoes, buscaNome]);

  // Paginação
  const totalPaginas = Math.ceil(movimentacoesFiltradas.length / ITEMS_PER_PAGE);
  const movimentacoesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_PER_PAGE;
    return movimentacoesFiltradas.slice(inicio, inicio + ITEMS_PER_PAGE);
  }, [movimentacoesFiltradas, pagina]);

  // Resetar página ao mudar filtros
  const handleTipoChange = (value: string) => {
    setTipoFiltro(value);
    setPagina(1);
  };

  const handleBuscaChange = (value: string) => {
    setBuscaNome(value);
    setPagina(1);
  };

  // Helper para formatar tipo
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'MUDANCA_DIVISAO':
        return <Badge className="bg-blue-500 hover:bg-blue-600">📦 Divisão</Badge>;
      case 'MUDANCA_REGIONAL':
        return <Badge className="bg-purple-500 hover:bg-purple-600">🌎 Regional</Badge>;
      case 'INATIVACAO':
        return <Badge variant="destructive">🔴 Inativação</Badge>;
      case 'REATIVACAO':
        return <Badge className="bg-green-500 hover:bg-green-600">🟢 Reativação</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  // Texto do escopo
  const escopoTexto = useMemo(() => {
    if (nivelAcesso === 'comando') {
      return 'Comando (todos os integrantes)';
    }
    if (nivelAcesso === 'regional') {
      return `Regional ${regionalUsuario || ''}`;
    }
    return `Divisão ${divisaoUsuario || ''}`;
  }, [nivelAcesso, regionalUsuario, divisaoUsuario]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Histórico de Movimentações
            </CardTitle>
            <CardDescription className="mt-1">
              Visualizando: Integrantes da {escopoTexto}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={buscaNome}
              onChange={(e) => handleBuscaChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFiltro} onValueChange={handleTipoChange}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Tipo de movimentação" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_MOVIMENTACAO.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : movimentacoesFiltradas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma movimentação encontrada
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-muted-foreground">Data</th>
                    <th className="text-left p-3 text-muted-foreground">Integrante</th>
                    <th className="text-left p-3 text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 text-muted-foreground">De → Para</th>
                    <th className="text-left p-3 text-muted-foreground">Divisão Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesPaginadas.map((mov) => (
                    <tr key={mov.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(mov.data_movimentacao), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </td>
                      <td className="p-3 font-medium">{mov.nome_colete}</td>
                      <td className="p-3">{getTipoBadge(mov.tipo_movimentacao)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {mov.valor_anterior || '—'}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {mov.valor_novo || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {mov.divisao_atual || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                Mostrando {((pagina - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(pagina * ITEMS_PER_PAGE, movimentacoesFiltradas.length)} de {movimentacoesFiltradas.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {pagina} / {totalPaginas || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina >= totalPaginas}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
