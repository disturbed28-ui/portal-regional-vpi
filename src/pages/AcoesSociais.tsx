import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Calendar, Users, MapPin, FileText, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useAcoesSociaisLista } from "@/hooks/useAcoesSociaisLista";
import { useEnviarAcaoSocialParaFormClube } from "@/hooks/useEnviarAcaoSocialParaFormClube";
import { useSolicitarExclusaoAcaoSocial } from "@/hooks/useSolicitarExclusaoAcaoSocial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AcoesSociais() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAccess, loading: loadingAccess } = useScreenAccess('/acoes-sociais', user?.id);
  const { registros, loading, refetch } = useAcoesSociaisLista();
  const enviarMutation = useEnviarAcaoSocialParaFormClube();
  const solicitarExclusaoMutation = useSolicitarExclusaoAcaoSocial();

  const [registroSelecionado, setRegistroSelecionado] = useState<any>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [mostrarExclusao, setMostrarExclusao] = useState(false);
  const [justificativaExclusao, setJustificativaExclusao] = useState("");

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
    navigate('/');
    return null;
  }

  const handleVerDetalhes = (registro: any) => {
    setRegistroSelecionado(registro);
    setMostrarDetalhes(true);
  };

  const handleEnviarFormulario = async (registro: any) => {
    await enviarMutation.mutateAsync(registro.id);
  };

  const handleSolicitarExclusao = (registro: any) => {
    setRegistroSelecionado(registro);
    setMostrarExclusao(true);
    setJustificativaExclusao("");
  };

  const handleConfirmarExclusao = async () => {
    if (!justificativaExclusao.trim()) {
      return;
    }

    await solicitarExclusaoMutation.mutateAsync({
      registro_id: registroSelecionado.id,
      justificativa: justificativaExclusao,
    });

    setMostrarExclusao(false);
    setRegistroSelecionado(null);
    setJustificativaExclusao("");
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'nao_enviado': { label: 'Não Enviado', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' },
      'enviado': { label: 'Enviado', className: 'bg-green-500/20 text-green-500 border-green-500/50' },
      'erro': { label: 'Erro', className: 'bg-red-500/20 text-red-500 border-red-500/50' },
    };

    const variant = variants[status as keyof typeof variants] || variants.nao_enviado;

    return (
      <Badge variant="outline" className={variant.className}>
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

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-full sm:max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Acoes Sociais</h1>
              <p className="text-sm text-muted-foreground">Consulta e gerenciamento</p>
            </div>
          </div>
          <Badge variant="secondary" className="h-8 px-3">
            {registros.length} {registros.length === 1 ? 'ação' : 'ações'}
          </Badge>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando ações sociais...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && registros.length === 0 && (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma acao social encontrada</h3>
            <p className="text-sm text-muted-foreground">
              Ainda nao ha acoes sociais registradas para visualizacao.
            </p>
          </Card>
        )}

        {/* Grid de Cards */}
        <div className="grid gap-4">
          {registros.map((registro) => (
            <Card key={registro.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">
                      {new Date(registro.data_acao).toLocaleDateString('pt-BR')}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {getStatusBadge(registro.google_form_status)}
                    {getEscopoBadge(registro.escopo_acao)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{registro.tipo_acao_nome_snapshot}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{registro.divisao_relatorio_texto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{registro.responsavel_nome_colete}</span>
                    {registro.responsavel_cargo_nome && (
                      <span className="text-muted-foreground">• {registro.responsavel_cargo_nome}</span>
                    )}
                  </div>
                  {registro.descricao_acao && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">
                        {registro.descricao_acao}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerDetalhes(registro)}
                    className="flex-1 min-w-[120px]"
                  >
                    Ver Detalhes
                  </Button>
                  {registro.google_form_status === 'nao_enviado' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleEnviarFormulario(registro)}
                      disabled={enviarMutation.isPending}
                      className="flex-1 min-w-[140px]"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar ao Formulário
                    </Button>
                  )}
                  {registro.profile_id === user?.id && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleSolicitarExclusao(registro)}
                      disabled={solicitarExclusaoMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Solicitar Exclusão
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal de Detalhes */}
        <Dialog open={mostrarDetalhes} onOpenChange={setMostrarDetalhes}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Acao Social</DialogTitle>
            </DialogHeader>
            {registroSelecionado && (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Data da Acao:</span>
                    <p className="font-medium">
                      {new Date(registroSelecionado.data_acao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                    <div>
                      <span className="text-muted-foreground">Status de Envio:</span>
                      <div className="mt-1">
                        {getStatusBadge(registroSelecionado.google_form_status)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Tipo de Acao:</span>
                    <p className="font-medium">{registroSelecionado.tipo_acao_nome_snapshot}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Escopo:</span>
                    <div className="mt-1">
                      {getEscopoBadge(registroSelecionado.escopo_acao)}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Regional:</span>
                    <p className="font-medium">{registroSelecionado.regional_relatorio_texto}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Divisao:</span>
                    <p className="font-medium">{registroSelecionado.divisao_relatorio_texto}</p>
                  </div>

                  <Separator />

                  <div>
                    <span className="text-muted-foreground">Responsável:</span>
                    <p className="font-medium">{registroSelecionado.responsavel_nome_colete}</p>
                  </div>

                  {registroSelecionado.responsavel_cargo_nome && (
                    <div>
                      <span className="text-muted-foreground">Cargo:</span>
                      <p className="font-medium">{registroSelecionado.responsavel_cargo_nome}</p>
                    </div>
                  )}

                  {registroSelecionado.descricao_acao && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-muted-foreground">Descricao:</span>
                        <p className="mt-1 whitespace-pre-wrap">{registroSelecionado.descricao_acao}</p>
                      </div>
                    </>
                  )}

                  {registroSelecionado.google_form_status === 'enviado' && (
                    <>
                      <Separator />
                      <div className="bg-green-500/10 p-3 rounded-md">
                        <p className="text-green-500 font-medium mb-1">Enviado ao Formulario Oficial</p>
                        {registroSelecionado.google_form_enviado_em && (
                          <p className="text-xs text-muted-foreground">
                            Em {new Date(registroSelecionado.google_form_enviado_em).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    <p>Criado em: {new Date(registroSelecionado.created_at).toLocaleString('pt-BR')}</p>
                    {registroSelecionado.updated_at !== registroSelecionado.created_at && (
                      <p>Atualizado em: {new Date(registroSelecionado.updated_at).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Solicitação de Exclusão */}
        <Dialog open={mostrarExclusao} onOpenChange={setMostrarExclusao}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Exclusao</DialogTitle>
              <DialogDescription>
                Informe o motivo da solicitacao de exclusao. Um administrador ira analisar sua solicitacao.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Digite a justificativa para a exclusao desta acao social..."
                value={justificativaExclusao}
                onChange={(e) => setJustificativaExclusao(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMostrarExclusao(false)}
                disabled={solicitarExclusaoMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmarExclusao}
                disabled={!justificativaExclusao.trim() || solicitarExclusaoMutation.isPending}
              >
                {solicitarExclusaoMutation.isPending ? 'Solicitando...' : 'Solicitar Exclusao'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
