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
import { useEmailLogs } from "@/hooks/useEmailLogs";
import { EmailLogDetailDialog } from "@/components/admin/EmailLogDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Filter, RefreshCw, X, ChevronRight, ArrowLeft } from "lucide-react";
import type { EmailLog } from "@/hooks/useEmailLogs";

const AdminEmailLogs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("all");
  const [statusSelecionado, setStatusSelecionado] = useState("all");

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
    refetch,
  } = useEmailLogs();

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
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
      tipo: tipoSelecionado !== "all" ? tipoSelecionado : undefined,
      status: statusSelecionado !== "all" ? statusSelecionado : undefined,
    });
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
              <Mail className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Logs de Email</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden md:block">
              Auditoria de todos os envios de email via Resend
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
              {/* Data Início e Fim lado a lado */}
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

              {/* Status */}
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
                Nenhum log de email encontrado para os filtros aplicados
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
                            {log.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {log.tipo.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm font-semibold truncate">{log.subject}</p>
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

      <EmailLogDetailDialog
        log={selectedLog}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
};

export default AdminEmailLogs;
