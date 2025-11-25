import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { SystemLogDetailDialog } from "@/components/admin/SystemLogDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Filter, RefreshCw, X, ChevronRight, ArrowLeft } from "lucide-react";
import type { SystemLog } from "@/hooks/useSystemLogs";

const AdminSystemLogs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const [origemSelecionada, setOrigemSelecionada] = useState("");
  const [userIdInput, setUserIdInput] = useState("");

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
    refetch,
  } = useSystemLogs();

  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!user || !hasRole('admin')) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar esta área",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, hasRole, authLoading, roleLoading, navigate, toast]);

  const handleApplyFilters = () => {
    applyFilters({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      tipo: tipoSelecionado || undefined,
      origem: origemSelecionada || undefined,
      userId: userIdInput || undefined,
    });
  };

  const handleClearFilters = () => {
    setDataInicio("");
    setDataFim("");
    setTipoSelecionado("");
    setOrigemSelecionada("");
    setUserIdInput("");
    clearFilters();
  };

  const handleRowClick = (log: SystemLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
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

  if (authLoading || roleLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Logs de Sistema</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden md:block">
              Auditoria e monitoramento de eventos do sistema
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button onClick={refetch} variant="outline" size="sm" disabled={loading} className="h-9 w-9 md:w-auto p-0 md:px-3">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline ml-2">Atualizar</span>
            </Button>
            <Button onClick={() => navigate("/admin")} variant="outline" size="sm" className="h-9 w-9 md:w-auto p-0 md:px-3">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline ml-2">Voltar</span>
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Filter className="h-4 w-4 md:h-5 md:w-5" />
              Filtros
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Refine os resultados aplicando filtros personalizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {/* Data Início e Fim lado a lado em mobile */}
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

              {/* Tipo */}
              <div className="space-y-1.5">
                <Label htmlFor="tipo" className="text-xs">Tipo</Label>
                <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                  <SelectTrigger id="tipo" className="h-9 text-xs">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os tipos</SelectItem>
                    {tiposDisponiveis.map((tipo) => (
                      <SelectItem key={tipo} value={tipo} className="text-xs">
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origem */}
              <div className="space-y-1.5">
                <Label htmlFor="origem" className="text-xs">Origem</Label>
                <Select value={origemSelecionada} onValueChange={setOrigemSelecionada}>
                  <SelectTrigger id="origem" className="h-9 text-xs">
                    <SelectValue placeholder="Todas as origens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as origens</SelectItem>
                    {origensDisponiveis.map((origem) => (
                      <SelectItem key={origem} value={origem} className="text-xs">
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User ID */}
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

            {/* Botões de Ação */}
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
          </CardContent>
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
                Nenhum log encontrado para os filtros aplicados
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
                            {log.notificacao_enviada ? '✓ Notificado' : 'Sem notificação'}
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
                  <div className="mt-4">
                    {/* Mobile: Simplified */}
                    <div className="flex md:hidden items-center justify-between gap-2">
                      <Button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="h-9 w-20"
                      >
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="h-9 w-20"
                      >
                        Próximo
                      </Button>
                    </div>

                    {/* Desktop: Full pagination */}
                    <div className="hidden md:flex justify-center gap-1">
                      <Button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        Anterior
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          return (
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                          );
                        })
                        .map((page, idx, arr) => {
                          const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                onClick={() => setCurrentPage(page)}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                className="h-9 w-9"
                              >
                                {page}
                              </Button>
                            </div>
                          );
                        })}
                      <Button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SystemLogDetailDialog
        log={selectedLog}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};

export default AdminSystemLogs;
