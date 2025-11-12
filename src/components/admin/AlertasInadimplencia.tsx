import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDivisoes } from "@/hooks/useDivisoes";
import { useAlertas } from "@/hooks/useAlertas";
import { useEnviarAlerta } from "@/hooks/useEnviarAlerta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Send, AlertTriangle, CheckCircle, XCircle, Clock, Eye, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AlertasInadimplencia = () => {
  const { user } = useAuth();
  const { divisoes } = useDivisoes();
  const { alertas, isLoading: loadingHistory } = useAlertas();
  const { mutate: enviarAlerta, isPending } = useEnviarAlerta();

  const [divisaoId, setDivisaoId] = useState<string>("");
  const [dryRun, setDryRun] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleEnviar = () => {
    if (!divisaoId) return;

    enviarAlerta(
      {
        tipo_alerta: 'INADIMPLENCIA_70_DIAS',
        divisao_id: divisaoId,
        dry_run: dryRun,
        test_email: testEmail || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.dry_run && data.preview) {
            setPreviewData(data);
            setPreviewOpen(true);
          }
        },
      }
    );
  };

  const handleConfirmarEnvio = () => {
    if (!divisaoId) return;
    setPreviewOpen(false);
    setDryRun(false);
    
    enviarAlerta({
      tipo_alerta: 'INADIMPLENCIA_70_DIAS',
      divisao_id: divisaoId,
      dry_run: false,
      test_email: testEmail || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline", icon: any, label: string }> = {
      enviado: { variant: "default", icon: CheckCircle, label: "Enviado" },
      erro: { variant: "destructive", icon: XCircle, label: "Erro" },
      ignorado: { variant: "secondary", icon: Clock, label: "Ignorado" },
      processando: { variant: "outline", icon: Clock, label: "Processando" },
    };

    const config = variants[status] || variants.processando;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Envio Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Alerta Manual
          </CardTitle>
          <CardDescription>
            Configure e envie alertas de inadimplência para uma divisão específica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="divisao">Divisão *</Label>
              <Select value={divisaoId} onValueChange={setDivisaoId}>
                <SelectTrigger id="divisao">
                  <SelectValue placeholder="Selecione a divisão" />
                </SelectTrigger>
                <SelectContent>
                  {divisoes.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      {div.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email">Email de Teste (Opcional)</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="teste@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se preenchido, o alerta será enviado para este email ao invés do diretor
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="dry-run" className="text-base font-medium">
                Modo Dry-Run (Prévia)
              </Label>
              <p className="text-sm text-muted-foreground">
                Visualize os alertas sem enviá-los
              </p>
            </div>
            <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Alertas são enviados apenas para devedores com <strong>3+ meses</strong> (≈70 dias) de atraso e valor total &gt; R$ 0.
            </AlertDescription>
          </Alert>

          <Separator />

          <Button
            onClick={handleEnviar}
            disabled={!divisaoId || isPending}
            className="w-full"
            size="lg"
          >
            <Send className="mr-2 h-4 w-4" />
            {isPending ? "Processando..." : dryRun ? "Visualizar Prévia" : "Enviar Alertas"}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Envios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
          <CardDescription>
            Acompanhe todos os alertas enviados, ignorados e com erro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando histórico...
            </div>
          ) : alertas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum alerta enviado ainda</p>
              <p className="text-sm">
                Envie seu primeiro alerta usando o formulário acima
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Integrante</TableHead>
                    <TableHead>Divisão</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="text-right">Dias Atraso</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.map((alerta) => (
                    <TableRow key={alerta.id}>
                      <TableCell className="whitespace-nowrap">
                        {alerta.enviado_em
                          ? format(new Date(alerta.enviado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{alerta.nome_colete}</TableCell>
                      <TableCell>{alerta.divisao_texto}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{alerta.destinatario_nome || "-"}</div>
                          <div className="text-muted-foreground text-xs">{alerta.email_destinatario}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{alerta.dias_atraso} dias</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R$ {alerta.valor_total.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>{getStatusBadge(alerta.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDetailsData(alerta);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Preview Dry-Run */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévia do Envio
            </DialogTitle>
            <DialogDescription>
              {previewData?.devedores_encontrados || 0} devedor(es) encontrado(s) em {previewData?.divisao}
            </DialogDescription>
          </DialogHeader>

          {previewData?.preview && previewData.preview.length > 0 ? (
            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Este é apenas uma prévia. <strong>Nenhum email será enviado</strong> até confirmar abaixo.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h4 className="font-semibold">Devedores que Receberão Alerta:</h4>
                {previewData.preview.map((item: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="pt-6">
                      <div className="grid gap-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Integrante:</span>
                          <span className="text-sm">{item.nome_colete}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Dias de Atraso:</span>
                          <Badge variant="destructive">{item.dias_atraso} dias</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Valor Total:</span>
                          <span className="text-sm font-mono">R$ {item.valor_total.toFixed(2).replace(".", ",")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Parcelas:</span>
                          <span className="text-sm">{item.total_parcelas}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium">Destinatário:</span>
                          <span className="text-sm text-right">{item.destinatario_email}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarEnvio} className="flex-1" disabled={isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar Envio Real
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum devedor elegível encontrado</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes do Log */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Alerta
            </DialogTitle>
          </DialogHeader>

          {detailsData && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">ID:</span>
                  <span className="text-sm font-mono">{detailsData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Run ID:</span>
                  <span className="text-sm font-mono">{detailsData.run_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Tipo:</span>
                  <span className="text-sm">{detailsData.tipo_alerta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(detailsData.status)}
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Integrante:</span>
                  <span className="text-sm">{detailsData.nome_colete}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Divisão:</span>
                  <span className="text-sm">{detailsData.divisao_texto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Destinatário:</span>
                  <span className="text-sm">{detailsData.destinatario_nome || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-sm">{detailsData.email_destinatario}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Message ID:</span>
                  <span className="text-sm font-mono text-xs break-all">{detailsData.message_id || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Template:</span>
                  <span className="text-sm">{detailsData.template_version || "-"}</span>
                </div>
                {detailsData.erro_mensagem && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Erro:</strong> {detailsData.erro_mensagem}
                    </AlertDescription>
                  </Alert>
                )}
                {detailsData.motivo_ignorado && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Motivo da Ignorância:</strong> {detailsData.motivo_ignorado}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertasInadimplencia;
