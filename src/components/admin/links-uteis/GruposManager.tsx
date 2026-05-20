import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLinksUteisGrupos, LinkUtilGrupo } from "@/hooks/useLinksUteis";
import { ICONES_LINKS_UTEIS, ICONES_LINKS_UTEIS_LISTA, getIconeLink, slugify } from "@/lib/iconesLinksUteis";
import { Edit, Trash2, Plus, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

function SortableGrupoRow({ grupo, onEdit, onDelete }: { grupo: LinkUtilGrupo; onEdit: (g: LinkUtilGrupo) => void; onDelete: (g: LinkUtilGrupo) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grupo.id });
  const Icon = getIconeLink(grupo.icone);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border rounded-md bg-background">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Icon className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{grupo.nome}</div>
        <div className="text-xs text-muted-foreground truncate">/links-uteis/{grupo.slug}{!grupo.ativo && " · inativo"}</div>
      </div>
      <Button variant="outline" size="sm" onClick={() => onEdit(grupo)}><Edit className="h-4 w-4" /></Button>
      <Button variant="destructive" size="sm" onClick={() => onDelete(grupo)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

export function GruposManager() {
  const { grupos, loading, addGrupo, updateGrupo, deleteGrupo, reorderGrupos } = useLinksUteisGrupos(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LinkUtilGrupo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkUtilGrupo | null>(null);
  const [form, setForm] = useState({ nome: "", slug: "", icone: "Link", ativo: true, slugTouched: false });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", slug: "", icone: "Link", ativo: true, slugTouched: false });
    setDialogOpen(true);
  };
  const openEdit = (g: LinkUtilGrupo) => {
    setEditing(g);
    setForm({ nome: g.nome, slug: g.slug, icone: g.icone, ativo: g.ativo, slugTouched: true });
    setDialogOpen(true);
  };

  const handleNomeChange = (nome: string) => {
    setForm(f => ({ ...f, nome, slug: f.slugTouched ? f.slug : slugify(nome) }));
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.slug.trim()) return;
    const slug = slugify(form.slug);
    const ok = editing
      ? await updateGrupo(editing.id, form.nome.trim(), slug, form.icone, form.ativo)
      : await addGrupo(form.nome.trim(), slug, form.icone, grupos.length);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteGrupo(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = grupos.findIndex(g => g.id === active.id);
    const newIdx = grupos.findIndex(g => g.id === over.id);
    const reordered = arrayMove(grupos, oldIdx, newIdx);
    await reorderGrupos(reordered.map((g, i) => ({ id: g.id, ordem: i })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Grupos</h2>
          <p className="text-sm text-muted-foreground">Arraste para reordenar. As permissões são gerenciadas em Admin &gt; Permissões.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo grupo</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum grupo cadastrado.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={grupos.map(g => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {grupos.map(g => (
                <SortableGrupoRow key={g.id} grupo={g} onEdit={openEdit} onDelete={setDeleteTarget} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => handleNomeChange(e.target.value)} placeholder="Ex: Manuais" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value, slugTouched: true }))} placeholder="manuais" />
              <p className="text-xs text-muted-foreground mt-1">Será usado na rota /links-uteis/{form.slug || "..."}</p>
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="mt-2 grid grid-cols-8 gap-2 max-h-56 overflow-y-auto p-2 border rounded-md">
                {ICONES_LINKS_UTEIS_LISTA.map(nome => {
                  const Icon = ICONES_LINKS_UTEIS[nome];
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icone: nome }))}
                      className={cn("aspect-square flex items-center justify-center rounded border hover:bg-accent", form.icone === nome && "bg-primary text-primary-foreground border-primary")}
                      title={nome}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            {editing && (
              <div className="flex items-center space-x-2">
                <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                <Label>Grupo ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{deleteTarget?.nome}"? Esta ação é bloqueada se houver links vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
