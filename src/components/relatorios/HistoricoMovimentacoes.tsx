import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, ArrowRightLeft, ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useHistoricoMovimentacoesCompleto } from '@/hooks/useHistoricoMovimentacoesCompleto';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HistoricoMovimentacoesProps {
  nivelAcesso: 'comando' | 'regional' | 'divisao';
  regionalUsuario?: string;
  divisaoUsuario?: string;
}

const TIPOS_MOVIMENTACAO = [
  { value: 'TODOS', label: 'Todos os tipos' },
  // Movimentações internas
  { value: 'MUDANCA_DIVISAO', label: '📦 Mudança de Divisão' },
  { value: 'MUDANCA_REGIONAL', label: '🌎 Mudança de Regional' },
  // Entradas
  { value: 'ENTRADA_NOVO', label: '🆕 Novo Integrante' },
  { value: 'ENTRADA_TRANSFERENCIA', label: '🔄 Transferência (Entrada)' },
  { value: 'ENTRADA_RETORNO_AFASTAMENTO', label: '♻️ Retorno de Afastamento' },
  // Saídas
  { value: 'SAIDA_TRANSFERENCIA', label: '📤 Transferência (Saída)' },
  { value: 'SAIDA_DESLIGAMENTO', label: '👋 Desligamento' },
  { value: 'SAIDA_EXPULSAO', label: '⛔ Expulsão' },
  { value: 'SAIDA_AFASTAMENTO', label: '⏸️ Entrou em Afastamento' },
  // Afastamentos
  { value: 'AFASTAMENTO_NOVO', label: '🏥 Novo Afastamento' },
  { value: 'AFASTAMENTO_RETORNO', label: '✅ Retorno de Afastado' },
  { value: 'AFASTAMENTO_SAIDA', label: '🚪 Saída de Afastado' },
  // Outros
  { value: 'INATIVACAO', label: '🔴 Inativação' },
  { value: 'REATIVACAO', label: '🟢 Reativação' },
];

const ITEMS_PER_PAGE = 50;

// Interface unificada para exibição
interface MovimentacaoUnificada {
  id: string;
  nome_colete: string;
  tipo_movimentacao: string;
  data_movimentacao: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  divisao_atual?: string | null;
  detalhes?: string | null;
  origem: 'carga' | 'delta';
}

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

  const { data: historico = [], isLoading, isError, refetch } = useHistoricoMovimentacoesCompleto({
    divisao: filtroIntegrantesDivisao,
    regional: filtroIntegrantesRegional,
  });
  const movimentacoesUnificadas = useMemo(() => historico.filter(m => {
    if (tipoFiltro === 'TODOS') return true;
    if (['SAIDA_AFASTAMENTO', 'AFASTAMENTO_NOVO'].includes(tipoFiltro)) return ['SAIDA_AFASTAMENTO', 'AFASTAMENTO_NOVO'].includes(m.tipo_movimentacao);
    if (['AFASTAMENTO_RETORNO', 'ENTRADA_RETORNO_AFASTAMENTO'].includes(tipoFiltro)) return ['AFASTAMENTO_RETORNO', 'ENTRADA_RETORNO_AFASTAMENTO'].includes(m.tipo_movimentacao);
    return m.tipo_movimentacao === tipoFiltro;
  }), [historico, tipoFiltro]);

  // Filtrar por nome localmente
  const movimentacoesFiltradas = useMemo(() => {
    let resultado = movimentacoesUnificadas;
    
    if (buscaNome.trim()) {
      const termo = buscaNome.toLowerCase();
      resultado = resultado.filter(m => 
        m.nome_colete.toLowerCase().includes(termo)
      );
    }
    
    return resultado;
  }, [movimentacoesUnificadas, buscaNome]);

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

  // Helper para formatar tipo com badge
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      // Movimentações internas
      case 'MUDANCA_DIVISAO':
        return <Badge className="bg-blue-500 hover:bg-blue-600">📦 Divisão</Badge>;
      case 'MUDANCA_REGIONAL':
        return <Badge className="bg-purple-500 hover:bg-purple-600">🌎 Regional</Badge>;
      // Entradas
      case 'ENTRADA_NOVO':
        return <Badge className="bg-green-500 hover:bg-green-600">🆕 Novo</Badge>;
      case 'ENTRADA_TRANSFERENCIA':
        return <Badge className="bg-cyan-500 hover:bg-cyan-600">🔄 Transf. Entrada</Badge>;
      case 'ENTRADA_RETORNO_AFASTAMENTO':
        return <Badge className="bg-teal-500 hover:bg-teal-600">♻️ Retorno Afast.</Badge>;
      // Saídas
      case 'SAIDA_TRANSFERENCIA':
        return <Badge className="bg-indigo-500 hover:bg-indigo-600">📤 Transf. Saída</Badge>;
      case 'SAIDA_DESLIGAMENTO':
        return <Badge className="bg-orange-500 hover:bg-orange-600">👋 Desligamento</Badge>;
      case 'SAIDA_EXPULSAO':
        return <Badge className="bg-red-700 hover:bg-red-800">⛔ Expulsão</Badge>;
      case 'SAIDA_AFASTAMENTO':
        return <Badge className="bg-amber-500 hover:bg-amber-600">⏸️ Afastamento</Badge>;
      // Afastamentos
      case 'AFASTAMENTO_NOVO':
        return <Badge className="bg-yellow-600 hover:bg-yellow-700">🏥 Novo Afast.</Badge>;
      case 'AFASTAMENTO_RETORNO':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">✅ Retorno</Badge>;
      case 'AFASTAMENTO_SAIDA':
        return <Badge className="bg-rose-500 hover:bg-rose-600">🚪 Saída Afast.</Badge>;
      // Outros
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
            <SelectTrigger className="w-full sm:w-[280px]">
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
        ) : isError ? (
          <div className="text-center py-12 text-destructive">Não foi possível carregar o histórico completo. Tente atualizar.</div>
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
                    <th className="text-left p-3 text-muted-foreground">Detalhes</th>
                    <th className="text-left p-3 text-muted-foreground">Divisão</th>
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
                        {mov.origem === 'carga' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {mov.valor_anterior || '—'}
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {mov.valor_novo || '—'}
                            </span>
                          </div>
                        ) : mov.detalhes ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help max-w-[200px]">
                                  <span className="text-muted-foreground truncate">
                                    {mov.detalhes.length > 40 
                                      ? `${mov.detalhes.substring(0, 40)}...` 
                                      : mov.detalhes}
                                  </span>
                                  <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p>{mov.detalhes}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
