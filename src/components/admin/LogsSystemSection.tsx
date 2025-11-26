import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { SystemLogDetailDialog } from "@/components/admin/SystemLogDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Filter, RefreshCw, X, ChevronRight, Bell, ChevronDown } from "lucide-react";
import type { SystemLog } from "@/hooks/useSystemLogs";
import { cn } from "@/lib/utils";

export const LogsSystemSection = () => {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("all");
  const [origemSelecionada, setOrigemSelecionada] = useState("all");
  const [userIdInput, setUserIdInput] = useState("");
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
    origensDisponiveis,
  } = useSystemLogs();

  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { getSettingValue, updateSetting, isLoading: settingsLoading } = useSystemSettings();
  const notificacoesAtivas = getSettingValue('notificacoes_email_admin');

  const handleApplyFilters = () => {
    applyFilters({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      tipo: tipoSelecionado !== "all" ? tipoSelecionado : undefined,
      origem: origemSelecionada !== "all" ? origemSelecionada : undefined,
      userId: userIdInput || undefined,
    });
    setFiltrosAbertos(false);
  };

  const handleClearFilters = () => {
    setDataInicio("");
    setDataFim("");
    setTipoSelecionado("all");
    setOrigemSelecionada("all");
    setUserIdInput("");
    clearFilters();
  };

  const handleRowClick = (log: SystemLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const handleToggleNotificacoes = (checked: boolean) => {
    updateSetting.mutate({ chave: 'notificacoes_email_admin', valor: checked });
  };

  const tipoColors: Record<string, string> = {
    AUTH_ERROR: 'bg-red-100 text-red-800',
    PERMISSION_DENIED: 'bg-orange-100 text-orange-800',
    FUNCTION_ERROR: 'bg-yellow-100 text-yellow-800',
    NETWORK_ERROR: 'bg-blue-100 text-blue-800',
    VALIDATION_ERROR: 'bg-purple-100 text-purple-800',
    DATABASE_ERROR: 'bg-pink-100 text-pink-800',
    UNKNOWN_ERROR: 'bg-gray-100 text-gray-800',
  };

  const filtrosAplicados = [dataInicio, dataFim, tipoSelecionado !== 'all', origemSelecionada !== 'all', userIdInput].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Notificações */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-medium">Notificações por email</span>
          </div>
          <Switch 
            checked={notificacoesAtivas}
            onCheckedChange={handleToggleNotificacoes}
            disabled={settingsLoading || updateSetting.isPending}
          />
        </CardContent>
      </Card>

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
                    <Label htmlFor="tipo" className="text-xs">Tipo</Label>
                    <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                      <SelectTrigger id="tipo" className="h-9 text-xs">
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {tiposDisponiveis.map((tipo) => (
                          <SelectItem key={tipo} value={tipo} className="text-xs">
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="origem" className="text-xs">Origem</Label>
                    <Select value={origemSelecionada} onValueChange={setOrigemSelecionada}>
                      <SelectTrigger id="origem" className="h-9 text-xs">
                        <SelectValue placeholder="Todas as origens" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as origens</SelectItem>
                        {origensDisponiveis.map((origem) => (
                          <SelectItem key={origem} value={origem} className="text-xs">
                            {origem}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="user-id" className="text-xs">User ID</Label>
                    <Input
                      id="user-id"
                      type="text"
                      placeholder="UUID do usuário"
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      className="h-9 text-xs"
                    />
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
              Nenhum log encontrado
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
                        <Badge className={`${tipoColors[log.tipo] || 'bg-gray-100 text-gray-800'} text-xs`}>
                          {log.tipo}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-mono text-muted-foreground line-clamp-1">
                          {log.origem}
                        </p>
                        {log.rota && (
                          <p className="text-xs flex items-center gap-1">
                            <span className="text-muted-foreground">→</span>
                            <span className="truncate">{log.rota}</span>
                          </p>
                        )}
                        {log.mensagem && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {log.mensagem}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {log.notificacao_enviada ? '✓' : '-'}
                        </span>
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
                      <TableHead>Origem</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="text-center">Notif.</TableHead>
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
                        <TableCell>
                          <Badge className={tipoColors[log.tipo] || 'bg-gray-100 text-gray-800'}>
                            {log.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">
                          {log.origem}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {log.rota || '-'}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {log.mensagem || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {log.notificacao_enviada ? '✓' : '-'}
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

      <SystemLogDetailDialog
        log={selectedLog}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};
