import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Eye, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useSolicitacoesExclusaoAcoesSociais } from "@/hooks/useSolicitacoesExclusaoAcoesSociais";
import { useProcessarSolicitacaoExclusaoAcaoSocial } from "@/hooks/useProcessarSolicitacaoExclusaoAcaoSocial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type StatusFiltro = 'pendente' | 'aprovado' | 'recusado' | 'todos';

const AdminAcoesSociaisExclusoes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading: loadingAccess } = useScreenAccess(
    '/admin/acoes-sociais/solicitacoes-exclusao',
    user?.id
  );

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('pendente');
  const { solicitacoes, loading, refetch } = useSolicitacoesExclusaoAcoesSociais(statusFiltro);
  const processarMutation = useProcessarSolicitacaoExclusaoAcaoSocial();

  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<any>(null);
  const [mostrarDialog, setMostrarDialog] = useState(false);
  const [observacaoAdmin, setObservacaoAdmin] = useState('');

  // Proteção de acesso
  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVerDetalhes = (solicitacao: any) => {
    setSolicitacaoSelecionada(solicitacao);
    setObservacaoAdmin('');
    setMostrarDialog(true);
  };

  const handleProcessar = async (novoStatus: 'aprovado' | 'recusado') => {
    if (!solicitacaoSelecionada) return;

    await processarMutation.mutateAsync({
      solicitacaoId: solicitacaoSelecionada.id,
      registroId: solicitacaoSelecionada.registro_id,
      novoStatus,
      observacaoAdmin: observacaoAdmin.trim() || undefined,
    });

    setMostrarDialog(false);
    setSolicitacaoSelecionada(null);
    setObservacaoAdmin('');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: {
        label: 'Pendente',
        className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      aprovado: {
        label: 'Aprovado',
        className: 'bg-green-500/20 text-green-500 border-green-500/50',
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
      },
      recusado: {
        label: 'Recusado',
        className: 'bg-red-500/20 text-red-500 border-red-500/50',
        icon: <XCircle className="h-3 w-3 mr-1" />,
      },
    };

    const variant = variants[status as keyof typeof variants] || variants.pendente;

    return (
      <Badge variant="outline" className={`${variant.className} flex items-center w-fit`}>
        {variant.icon}
        {variant.label}
      </Badge>
    );
  };

  const getEscopoBadge = (escopo: string) => {
    return escopo === 'externa' ? (
      <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
        Externa
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
        Interna
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Admin
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                Solicitações de Exclusão
              </h1>
              <p className="text-muted-foreground">
                Revise e processe solicitações de exclusão de ações sociais
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de Status */}
        <div className="mb-6">
          <Label htmlFor="status-filter" className="mb-2 block">
            Filtrar por status:
          </Label>
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovado">Aprovadas</SelectItem>
              <SelectItem value="recusado">Recusadas</SelectItem>
              <SelectItem value="todos">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && solicitacoes.length === 0 && (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma solicitação encontrada
            </h3>
            <p className="text-sm text-muted-foreground">
              Não há solicitações de exclusão com o status "{statusFiltro}".
            </p>
          </Card>
        )}

        {/* Listagem de Solicitações */}
        {!loading && solicitacoes.length > 0 && (
          <div className="grid gap-4">
            {solicitacoes.map((solicitacao: any) => (
              <Card key={solicitacao.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {solicitacao.registro?.responsavel_nome_colete || 'Desconhecido'}
                        {getStatusBadge(solicitacao.status)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Solicitado em {formatDate(solicitacao.created_at)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerDetalhes(solicitacao)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalhes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Data da Ação:</span>
                      <p className="text-muted-foreground">
                        {new Date(solicitacao.registro?.data_acao || '').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold">Escopo:</span>
                      <p className="mt-1">{getEscopoBadge(solicitacao.registro?.escopo_acao || '')}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Tipo de Ação:</span>
                      <p className="text-muted-foreground">
                        {solicitacao.registro?.tipo_acao_nome_snapshot || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold">Divisão:</span>
                      <p className="text-muted-foreground">
                        {solicitacao.registro?.divisao_relatorio_texto || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog de Detalhes */}
        <Dialog open={mostrarDialog} onOpenChange={setMostrarDialog}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Detalhes da Solicitação de Exclusão</DialogTitle>
              <DialogDescription>
                Analise as informações antes de processar
              </DialogDescription>
            </DialogHeader>

            {solicitacaoSelecionada && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  {/* Status */}
                  <div>
                    <Label className="mb-2 block">Status:</Label>
                    {getStatusBadge(solicitacaoSelecionada.status)}
                  </div>

                  <Separator />

                  {/* Informações da Ação Social */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Ação Social</h4>
                    <div className="bg-muted/50 border rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold">Data:</span>
                        <span>
                          {new Date(
                            solicitacaoSelecionada.registro?.data_acao || ''
                          ).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Escopo:</span>
                        {getEscopoBadge(solicitacaoSelecionada.registro?.escopo_acao || '')}
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Tipo:</span>
                        <span>{solicitacaoSelecionada.registro?.tipo_acao_nome_snapshot || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Divisão:</span>
                        <span>{solicitacaoSelecionada.registro?.divisao_relatorio_texto || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Responsável:</span>
                        <span>{solicitacaoSelecionada.registro?.responsavel_nome_colete || 'N/A'}</span>
                      </div>
                      {solicitacaoSelecionada.registro?.descricao_acao && (
                        <div>
                          <span className="font-semibold">Descrição:</span>
                          <p className="text-muted-foreground mt-1">
                            {solicitacaoSelecionada.registro.descricao_acao}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Justificativa do Usuário */}
                  <div className="space-y-2">
                    <Label>Justificativa do Usuário:</Label>
                    <div className="bg-card border rounded-lg p-4">
                      <p className="text-card-foreground whitespace-pre-wrap leading-relaxed">
                        {solicitacaoSelecionada.justificativa || 'Nenhuma justificativa fornecida'}
                      </p>
                    </div>
                  </div>

                  {/* Se já processado */}
                  {(solicitacaoSelecionada.status === 'aprovado' ||
                    solicitacaoSelecionada.status === 'recusado') && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="font-semibold">Processamento</h4>
                        <div className="bg-muted/50 border rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-semibold">Processado em:</span>
                            <span>
                              {solicitacaoSelecionada.processado_em
                                ? formatDate(solicitacaoSelecionada.processado_em)
                                : 'N/A'}
                            </span>
                          </div>
                          {solicitacaoSelecionada.observacao_admin && (
                            <div>
                              <span className="font-semibold">Observação do Admin:</span>
                              <p className="text-muted-foreground mt-1">
                                {solicitacaoSelecionada.observacao_admin}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Campo de Observação Admin (apenas se pendente) */}
                  {solicitacaoSelecionada.status === 'pendente' && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="observacao-admin">
                          Observação Administrativa (opcional)
                        </Label>
                        <Textarea
                          id="observacao-admin"
                          placeholder="Adicione uma observação sobre esta decisão..."
                          value={observacaoAdmin}
                          onChange={(e) => setObservacaoAdmin(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              {solicitacaoSelecionada?.status === 'pendente' ? (
                <>
                  <Button variant="outline" onClick={() => setMostrarDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleProcessar('recusado')}
                    disabled={processarMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Recusar Exclusão
                  </Button>
                  <Button
                    onClick={() => handleProcessar('aprovado')}
                    disabled={processarMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {processarMutation.isPending ? 'Processando...' : 'Aprovar Exclusão'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setMostrarDialog(false)}>
                  Fechar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminAcoesSociaisExclusoes;
