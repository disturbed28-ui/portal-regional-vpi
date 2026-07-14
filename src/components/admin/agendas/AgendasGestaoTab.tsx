import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarDays, Info } from "lucide-react";

interface AgendaCalendar {
  id: string;
  nome: string;
  calendar_id: string;
  ativo: boolean;
  palavras_chave: string[];
  ver_flag_caveira: boolean;
  ver_flag_lobo: boolean;
  ver_flag_ursinho: boolean;
  ver_grau_v_regional: boolean;
  ordem: number;
}

interface Props {
  readOnly?: boolean;
}

const emptyForm = {
  nome: "",
  calendar_id: "",
  ativo: true,
  palavras_chave_texto: "",
  ver_flag_caveira: false,
  ver_flag_lobo: false,
  ver_flag_ursinho: false,
  ver_grau_v_regional: false,
  ordem: 0,
};

export const AgendasGestaoTab = ({ readOnly = false }: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AgendaCalendar | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgendaCalendar | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: agendas, isLoading } = useQuery({
    queryKey: ["agenda_calendars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_calendars")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AgendaCalendar[];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: AgendaCalendar) => {
    setEditing(a);
    setForm({
      nome: a.nome,
      calendar_id: a.calendar_id,
      ativo: a.ativo,
      palavras_chave_texto: (a.palavras_chave || []).join(", "),
      ver_flag_caveira: a.ver_flag_caveira,
      ver_flag_lobo: a.ver_flag_lobo,
      ver_flag_ursinho: a.ver_flag_ursinho,
      ver_grau_v_regional: a.ver_grau_v_regional,
      ordem: a.ordem,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const palavras = form.palavras_chave_texto
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        nome: form.nome.trim(),
        calendar_id: form.calendar_id.trim(),
        ativo: form.ativo,
        palavras_chave: palavras,
        ver_flag_caveira: form.ver_flag_caveira,
        ver_flag_lobo: form.ver_flag_lobo,
        ver_flag_ursinho: form.ver_flag_ursinho,
        ver_grau_v_regional: form.ver_grau_v_regional,
        ordem: Number(form.ordem) || 0,
      };
      if (!payload.nome || !payload.calendar_id) {
        throw new Error("Nome e ID do calendário são obrigatórios");
      }
      if (editing) {
        const { error } = await supabase
          .from("agenda_calendars")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agenda_calendars").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_calendars"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setDialogOpen(false);
      toast({ title: editing ? "Agenda atualizada" : "Agenda cadastrada" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err?.message || "Falha ao salvar agenda",
        variant: "destructive",
      });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async (a: AgendaCalendar) => {
      const { error } = await supabase
        .from("agenda_calendars")
        .update({ ativo: !a.ativo })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_calendars"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (err: any) =>
      toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (a: AgendaCalendar) => {
      const { error } = await supabase.from("agenda_calendars").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_calendars"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      setDeleteTarget(null);
      toast({ title: "Agenda removida" });
    },
    onError: (err: any) =>
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Calendários da Agenda
          </h3>
          <p className="text-sm text-muted-foreground">
            Cadastre os IDs dos Google Calendar exibidos na Agenda do portal e, se necessário,
            defina regras de visibilidade por palavras-chave no título.
          </p>
        </div>
        {!readOnly && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova agenda
          </Button>
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-xs text-muted-foreground flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona:</strong> se um evento tiver alguma das palavras-chave no
            título, só verão o evento os integrantes que atendam a pelo menos uma das regras
            marcadas ("Ver Caveira", "Ver Lobo", "Ver Ursinho", ou "Grau V da mesma regional").
            Se não houver palavras-chave, todos os usuários enxergam.
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando agendas...</p>
      )}

      <div className="grid gap-3">
        {agendas?.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {a.nome}
                    {a.ativo ? (
                      <Badge variant="default">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground break-all mt-1 font-mono">
                    {a.calendar_id}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span>Ativa</span>
                      <Switch
                        checked={a.ativo}
                        onCheckedChange={() => toggleAtivo.mutate(a)}
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex flex-wrap gap-1">
                {(a.palavras_chave || []).length === 0 ? (
                  <Badge variant="outline">Sem restrição de título</Badge>
                ) : (
                  (a.palavras_chave || []).map((kw) => (
                    <Badge key={kw} variant="secondary">{kw}</Badge>
                  ))
                )}
              </div>
              {(a.palavras_chave || []).length > 0 && (
                <div className="flex flex-wrap gap-1 text-xs">
                  {a.ver_flag_caveira && <Badge variant="outline">Ver Caveira</Badge>}
                  {a.ver_flag_lobo && <Badge variant="outline">Ver Lobo</Badge>}
                  {a.ver_flag_ursinho && <Badge variant="outline">Ver Ursinho</Badge>}
                  {a.ver_grau_v_regional && (
                    <Badge variant="outline">Grau V da regional</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {agendas && agendas.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma agenda cadastrada ainda.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar agenda" : "Nova agenda"}</DialogTitle>
            <DialogDescription>
              Preencha o ID do Google Calendar e, opcionalmente, defina regras de visibilidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Agenda Regional, Grupos de Elite"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID do Google Calendar</Label>
              <Input
                value={form.calendar_id}
                onChange={(e) => setForm({ ...form, calendar_id: e.target.value })}
                placeholder="xxxx@group.calendar.google.com"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo-switch">Agenda ativa</Label>
              <Switch
                id="ativo-switch"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ordem (menor aparece primeiro)</Label>
              <Input
                type="number"
                value={form.ordem}
                onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <Label>Palavras-chave no título (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Separadas por vírgula. Se o título contiver alguma delas, o evento vira
                  restrito e só verão quem atender às regras abaixo. Deixe vazio para todos
                  enxergarem tudo desta agenda.
                </p>
                <Textarea
                  value={form.palavras_chave_texto}
                  onChange={(e) =>
                    setForm({ ...form, palavras_chave_texto: e.target.value })
                  }
                  placeholder="caveira, lobo, urso, ursinho"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Quem pode enxergar eventos restritos:</Label>
                <div className="flex items-center justify-between text-sm">
                  <span>Integrantes com flag Caveira / Caveira Suplente</span>
                  <Switch
                    checked={form.ver_flag_caveira}
                    onCheckedChange={(v) => setForm({ ...form, ver_flag_caveira: v })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Integrantes com flag Lobo</span>
                  <Switch
                    checked={form.ver_flag_lobo}
                    onCheckedChange={(v) => setForm({ ...form, ver_flag_lobo: v })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Integrantes com flag Ursinho</span>
                  <Switch
                    checked={form.ver_flag_ursinho}
                    onCheckedChange={(v) => setForm({ ...form, ver_flag_ursinho: v })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Grau V da mesma regional do evento</span>
                  <Switch
                    checked={form.ver_grau_v_regional}
                    onCheckedChange={(v) =>
                      setForm({ ...form, ver_grau_v_regional: v })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agenda?</AlertDialogTitle>
            <AlertDialogDescription>
              A agenda "{deleteTarget?.nome}" deixará de ser consultada pela Agenda do portal.
              Esta ação pode ser desfeita cadastrando novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
