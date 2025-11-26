import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEmailLogs } from "@/hooks/useEmailLogs";
import { EmailLogDetailDialog } from "@/components/admin/EmailLogDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Filter, RefreshCw, X, ChevronRight, ChevronDown } from "lucide-react";
import type { EmailLog } from "@/hooks/useEmailLogs";
import { cn } from "@/lib/utils";

export const LogsEmailSection = () => {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("all");
  const [statusSelecionado, setStatusSelecionado] = useState("all");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const {
    logs,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    totalCount,
    applyFilters,
    clearFilters,
    tiposDisponiveis,
  } = useEmailLogs();

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handleApplyFilters = () => {
    applyFilters({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      tipo: tipoSelecionado !== "all" ? tipoSelecionado : undefined,
      status: statusSelecionado !== "all" ? statusSelecionado : undefined,
    });
    setFiltrosAbertos(false);
  };

  const handleClearFilters = () => {
    setDataInicio("");
    setDataFim("");
    setTipoSelecionado("all");
    setStatusSelecionado("all");
    clearFilters();
  };

  const handleRowClick = (log: EmailLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const filtrosAplicados = [dataInicio, dataFim, tipoSelecionado !== 'all', statusSelecionado !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Filtros Collapsible */}
      <Card>
        <CardHeader className="pb-3">
          <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 md:h-5 md:w-5" />
                <CardTitle className="text-base md:text-lg">Filtros</CardTitle>
                {filtrosAplicados > 0 && (
                  <Badge variant="secondary" className="text-xs">{filtrosAplicados}</Badge>
                )}
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", filtrosAbertos && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <CardDescription className="text-xs md:text-sm mb-3">
                Refine os resultados aplicando filtros personalizados
              </CardDescription>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="data-inicio" className="text-xs">Data Início</Label>
                      <Input
                        id="data-inicio"
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="data-fim" className="text-xs">Data Fim</Label>
                      <Input
                        id="data-fim"
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tipo" className="text-xs">Tipo de Email</Label>
                    <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                      <SelectTrigger id="tipo" className="h-9 text-xs">
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {tiposDisponiveis.map((tipo) => (
                          <SelectItem key={tipo} value={tipo} className="text-xs">
                            {tipo.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="status" className="text-xs">Status</Label>
                    <Select value={statusSelecionado} onValueChange={setStatusSelecionado}>
                      <SelectTrigger id="status" className="h-9 text-xs">
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="erro">Erro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleApplyFilters} disabled={loading} size="sm" className="h-9 text-xs">
                    <Filter className="h-3 w-3 mr-1.5" />
                    Aplicar
                  </Button>
                  <Button onClick={handleClearFilters} variant="outline" disabled={loading} size="sm" className="h-9 text-xs">
                    <X className="h-3 w-3 mr-1.5" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            Resultados
            {totalCount > 0 && (
              <span className="text-xs md:text-sm font-normal text-muted-foreground ml-2">
                ({totalCount} registro{totalCount !== 1 ? 's' : ''})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum log de email encontrado
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="space-y-3 md:hidden">
                {logs.map((log) => (
                  <Card
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(log)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge className={log.status === 'enviado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {log.status === 'enviado' ? '✓' : '✗'}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground line-clamp-1">
                          {log.tipo.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm font-semibold line-clamp-1">{log.subject}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span>→</span>
                          <span className="truncate">{log.to_nome || log.to_email}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-end mt-2 pt-2 border-t">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(log)}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.tipo.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.to_nome ? (
                            <>
                              <div className="font-medium">{log.to_nome}</div>
                              <div className="text-xs text-muted-foreground">{log.to_email}</div>
                            </>
                          ) : (
                            log.to_email
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={log.status === 'enviado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {log.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="h-9"
                  >
                    ‹
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className="h-9"
                  >
                    ›
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <EmailLogDetailDialog
        log={selectedLog}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};
