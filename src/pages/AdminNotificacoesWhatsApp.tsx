import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, MessageCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useAuth } from "@/hooks/useAuth";
import {
  useWhatsAppTemplates, useWhatsAppLogs, type WhatsAppTemplate, type NewWhatsAppTemplate,
} from "@/hooks/useWhatsAppTemplates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ESCOPOS = ["generico", "relatorios", "mensalidades", "eventos", "aniversariantes"];

const emptyTemplate: NewWhatsAppTemplate = {
  chave: "",
  titulo: "",
  descricao: "",
  corpo: "",
  escopo: "generico",
  variaveis_disponiveis: [],
  ativo: true,
};

const AdminNotificacoesWhatsApp = () => {
  const { user } = useAuth();
  const { hasAccess, loading: accessLoading } = useScreenAccess("/admin/notificacoes-whatsapp", user?.id);
  const { data: templates = [], isLoading, create, update, remove } = useWhatsAppTemplates();
  const { data: logs = [] } = useWhatsAppLogs(50);

  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const [form, setForm] = useState<NewWhatsAppTemplate>(emptyTemplate);
  const [open, setOpen] = useState(false);

  if (accessLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">Acesso negado</p>
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setForm(emptyTemplate);
    setOpen(true);
  };

  const openEdit = (tpl: WhatsAppTemplate) => {
    setEditing(tpl);
    setForm({
      chave: tpl.chave,
      titulo: tpl.titulo,
      descricao: tpl.descricao ?? "",
      corpo: tpl.corpo,
      escopo: tpl.escopo,
      variaveis_disponiveis: tpl.variaveis_disponiveis ?? [],
      ativo: tpl.ativo,
    });
    setOpen(true);
  };

  const handleSave = () => {
    const variaveis = Array.from(new Set(
      Array.from(form.corpo.matchAll(/\{\{#?(\w+)\}?\}?/g)).map((m) => m[1])
    )).filter((v) => !["#", "/"].includes(v));

    const payload = { ...form, variaveis_disponiveis: variaveis };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 sm:px-6 sm:py-8 max-w-6xl">
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
          </Button>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Notificações WhatsApp</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Templates de mensagem e log de envios via wa.me
          </p>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="templates" className="flex-shrink-0">Templates</TabsTrigger>
            <TabsTrigger value="logs" className="flex-shrink-0">
              <History className="h-4 w-4 mr-1" /> Log de envios
            </TabsTrigger>
          </TabsList>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>

            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : templates.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhum template cadastrado
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {templates.map((tpl) => (
                  <Card key={tpl.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            <span className="truncate">{tpl.titulo}</span>
                            <Badge variant="outline" className="text-xs">{tpl.escopo}</Badge>
                            {!tpl.ativo && <Badge variant="secondary" className="text-xs">inativo</Badge>}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1 font-mono">{tpl.chave}</CardDescription>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover template?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O template "{tpl.titulo}" será removido permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(tpl.id)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {tpl.descricao && (
                        <p className="text-xs text-muted-foreground mb-2">{tpl.descricao}</p>
                      )}
                      <pre className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap font-sans border">
                        {tpl.corpo}
                      </pre>
                      {tpl.variaveis_disponiveis?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tpl.variaveis_disponiveis.map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* LOGS */}
          <TabsContent value="logs" className="space-y-3">
            {logs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhum envio registrado ainda
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {logs.map((log: any) => (
                  <Card key={log.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{log.destinatario_nome}</span>
                            <Badge variant="outline" className="text-xs">{log.modulo_origem}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            de {log.remetente_nome ?? "—"} • {log.destinatario_telefone}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })} • template: <span className="font-mono">{log.template_chave}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG NOVO/EDITAR */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[98vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>
              Use {`{{nome}}`} para variáveis simples e {`{{#campo}}...{{/campo}}`} para blocos condicionais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="chave">Chave (única) *</Label>
                <Input id="chave" value={form.chave} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, chave: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="ex: cobranca_relatorio" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="escopo">Escopo</Label>
                <Select value={form.escopo} onValueChange={(v) => setForm({ ...form, escopo: v })}>
                  <SelectTrigger id="escopo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESCOPOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="ex: Cobrança de Relatório" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" value={form.descricao ?? ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="corpo">Corpo da mensagem *</Label>
              <Textarea id="corpo" rows={8} value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
                className="font-mono text-sm"
                placeholder="Olá {{nome}}, ..." />
              <p className="text-xs text-muted-foreground">
                Variáveis detectadas serão registradas automaticamente ao salvar.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch id="ativo" checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}
              disabled={!form.chave || !form.titulo || !form.corpo || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNotificacoesWhatsApp;
