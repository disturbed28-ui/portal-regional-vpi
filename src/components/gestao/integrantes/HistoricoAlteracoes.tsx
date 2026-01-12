import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Calendar as CalendarIcon, 
  History, 
  User, 
  Pencil, 
  ArrowRight,
  Filter,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  useHistoricoIntegrantes, 
  extrairAlteracoes, 
  LABELS_CAMPOS,
  type FiltrosHistorico 
} from "@/hooks/useHistoricoIntegrantes";

export function HistoricoAlteracoes() {
  const [filtros, setFiltros] = useState<FiltrosHistorico>({
    busca: '',
    campoAlterado: 'todos',
    dataInicio: null,
    dataFim: null
  });
  
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const { historico, loading, error, camposDisponiveis } = useHistoricoIntegrantes(filtros);
  
  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const limparFiltros = () => {
    setFiltros({
      busca: '',
      campoAlterado: 'todos',
      dataInicio: null,
      dataFim: null
    });
  };
  
  const temFiltrosAtivos = filtros.busca || filtros.campoAlterado !== 'todos' || filtros.dataInicio || filtros.dataFim;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48 mb-3" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <History className="h-10 w-10 text-destructive/70 mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">Erro ao carregar</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtros */}
      <div className="space-y-3">
        {/* Busca principal */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do integrante..."
            value={filtros.busca}
            onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
            className="pl-9 pr-10"
          />
          {filtros.busca && (
            <button
              onClick={() => setFiltros(prev => ({ ...prev, busca: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Toggle filtros avançados */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros avançados
            {temFiltrosAtivos && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {[filtros.campoAlterado !== 'todos', filtros.dataInicio, filtros.dataFim].filter(Boolean).length}
              </Badge>
            )}
          </span>
          {mostrarFiltros ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {/* Filtros avançados */}
        {mostrarFiltros && (
          <Card className="border-border/50">
            <CardContent className="p-3 space-y-3">
              {/* Filtro por campo */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Campo alterado</label>
                <Select
                  value={filtros.campoAlterado}
                  onValueChange={(value) => setFiltros(prev => ({ ...prev, campoAlterado: value }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os campos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os campos</SelectItem>
                    {camposDisponiveis.map(campo => (
                      <SelectItem key={campo} value={campo}>
                        {LABELS_CAMPOS[campo] || campo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtros de data */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !filtros.dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataInicio ? format(filtros.dataInicio, "dd/MM/yy", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.dataInicio || undefined}
                        onSelect={(date) => setFiltros(prev => ({ ...prev, dataInicio: date || null }))}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !filtros.dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataFim ? format(filtros.dataFim, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.dataFim || undefined}
                        onSelect={(date) => setFiltros(prev => ({ ...prev, dataFim: date || null }))}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              {/* Botão limpar */}
              {temFiltrosAtivos && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltros}
                  className="w-full text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Contador de resultados */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{historico.length} registro{historico.length !== 1 ? 's' : ''}</span>
      </div>
      
      {/* Lista de alterações */}
      {historico.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {temFiltrosAtivos ? 'Nenhum resultado' : 'Sem histórico'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {temFiltrosAtivos 
                ? 'Nenhuma alteração encontrada com os filtros aplicados.'
                : 'Ainda não há alterações de perfil registradas.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="space-y-3 pr-2">
            {historico.map((item) => {
              const alteracoes = extrairAlteracoes(item.dados_anteriores, item.dados_novos);
              const isExpanded = expandedCards.has(item.id);
              const temMaisAlteracoes = alteracoes.length > 2;
              const alteracoesVisiveis = isExpanded ? alteracoes : alteracoes.slice(0, 2);
              
              return (
                <Card key={item.id} className="border-border/50 overflow-hidden">
                  <CardContent className="p-0">
                    {/* Cabeçalho: Integrante afetado */}
                    <div className="px-4 py-3 border-b border-border/30 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">{item.integrante_nome_colete}</span>
                      </div>
                      {item.integrante_divisao && (
                        <p className="text-xs text-muted-foreground mt-0.5 pl-6">
                          {item.integrante_divisao}
                        </p>
                      )}
                    </div>
                    
                    {/* Alterações */}
                    <div className="px-4 py-3 space-y-2">
                      {alteracoesVisiveis.map((alt, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs font-normal h-5 px-1.5">
                              {alt.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm pl-0.5">
                            <span className="text-muted-foreground line-through truncate max-w-[40%]">
                              {alt.valorAnterior}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-foreground font-medium truncate max-w-[40%]">
                              {alt.valorNovo}
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {/* Botão expandir/recolher */}
                      {temMaisAlteracoes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(item.id)}
                          className="w-full h-7 text-xs text-muted-foreground mt-1"
                        >
                          {isExpanded 
                            ? <>Recolher <ChevronUp className="h-3 w-3 ml-1" /></>
                            : <>+{alteracoes.length - 2} alterações <ChevronDown className="h-3 w-3 ml-1" /></>
                          }
                        </Button>
                      )}
                    </div>
                    
                    {/* Rodapé: Editor e data */}
                    <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20">
                      <div className="flex items-start gap-2 text-xs">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {item.editor_nome_colete ? (
                            <>
                              <span className="font-medium text-foreground">{item.editor_nome_colete}</span>
                              {item.editor_cargo && (
                                <span className="text-muted-foreground"> · {item.editor_cargo}</span>
                              )}
                              {item.editor_divisao && (
                                <p className="text-muted-foreground truncate">{item.editor_divisao}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">Editor não identificado</span>
                          )}
                        </div>
                        <span className="text-muted-foreground flex-shrink-0">
                          {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {item.observacao && (
                        <p className="text-xs text-muted-foreground mt-1.5 pl-5 italic">
                          "{item.observacao}"
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
