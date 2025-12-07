import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, Users, AlertTriangle, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useEventosCanceladosPendentes, EventoCanceladoPendente } from "@/hooks/useEventosCanceladosPendentes";
import { supabase } from "@/integrations/supabase/client";

const AdminEventosAgendaPendentes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  
  const { data: eventos, isLoading, refetch } = useEventosCanceladosPendentes(user?.id, !!hasAccess);
  
  const [selectedEvento, setSelectedEvento] = useState<EventoCanceladoPendente | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Verificar acesso
  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar esta página.
            </p>
            <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenArchiveDialog = (evento: EventoCanceladoPendente) => {
    setSelectedEvento(evento);
    setMotivoExclusao("");
    setDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!selectedEvento || !motivoExclusao.trim() || !user?.id) {
      toast({
        title: "Erro",
        description: "Preencha o motivo da exclusão",
        variant: "destructive"
      });
      return;
    }

    setIsArchiving(true);

    try {
      const { data, error } = await supabase.functions.invoke('archive-cancelled-event', {
        body: {
          evento_id: selectedEvento.id,
          motivo_exclusao: motivoExclusao.trim(),
          user_id: user.id
        }
      });

      if (error) throw error;

      toast({
        title: "Evento arquivado",
        description: `Evento "${selectedEvento.titulo}" arquivado com sucesso. ${data.presencas_arquivadas} presenças movidas para o histórico.`,
      });

      setDialogOpen(false);
      setSelectedEvento(null);
      setMotivoExclusao("");
      refetch();

    } catch (error) {
      console.error('[AdminEventosAgendaPendentes] Erro ao arquivar:', error);
      toast({
        title: "Erro ao arquivar",
        description: "Não foi possível arquivar o evento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const formatarData = (data: string) => 
    format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const getStatusBadge = (status: 'cancelled' | 'removed') => {
    if (status === 'cancelled') {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">📅 Cancelado</Badge>;
    }
    return <Badge variant="destructive">❌ Removido</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Eventos da Agenda Pendentes</h1>
              <p className="text-sm text-muted-foreground">
                Eventos cancelados/removidos com lista de presença
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !eventos || eventos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum evento pendente</h3>
              <p className="text-muted-foreground">
                Não há eventos cancelados ou removidos com lista de presença.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {eventos.length} evento(s) pendente(s) de tratamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4">
                {eventos.map((evento) => (
                  <Card key={evento.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{evento.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatarData(evento.data_evento)}
                          </p>
                        </div>
                        {getStatusBadge(evento.status)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {evento.divisao_nome || 'Sem divisão'}
                        </span>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {evento.total_presencas} presenças
                        </Badge>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => handleOpenArchiveDialog(evento)}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Excluir e Arquivar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Divisão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((evento) => (
                      <TableRow key={evento.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatarData(evento.data_evento)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={evento.titulo}>
                          {evento.titulo}
                        </TableCell>
                        <TableCell>{evento.divisao_nome || 'Sem divisão'}</TableCell>
                        <TableCell>{getStatusBadge(evento.status)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="flex items-center gap-1 justify-center">
                            <Users className="h-3 w-3" />
                            {evento.total_presencas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleOpenArchiveDialog(evento)}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Excluir e Arquivar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Modal de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-destructive" />
              Excluir e Arquivar Evento
            </DialogTitle>
            <DialogDescription>
              Esta ação irá:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Mover o evento para a base de histórico</li>
              <li>Copiar {selectedEvento?.total_presencas} presença(s) para o histórico</li>
              <li>Remover o evento da base principal</li>
              <li><strong>O evento deixará de impactar o aproveitamento dos integrantes</strong></li>
            </ul>

            {selectedEvento && (
              <Card className="bg-secondary/50">
                <CardContent className="p-3 space-y-1">
                  <p className="font-medium">{selectedEvento.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatarData(selectedEvento.data_evento)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvento.divisao_nome || 'Sem divisão'}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da exclusão *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo pelo qual este evento está sendo arquivado..."
                value={motivoExclusao}
                onChange={(e) => setMotivoExclusao(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              disabled={isArchiving}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleArchive}
              disabled={isArchiving || !motivoExclusao.trim()}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Arquivando...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEventosAgendaPendentes;
