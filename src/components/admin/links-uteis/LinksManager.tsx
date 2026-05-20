import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useLinksUteis, useLinksUteisGrupos, LinkUtil } from "@/hooks/useLinksUteis";
import { getIconeLink } from "@/lib/iconesLinksUteis";
import { Edit, Trash2, Plus, ExternalLink, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableLinkRow({ link, onEdit, onDelete, onToggle }: { link: LinkUtil; onEdit: (l: LinkUtil) => void; onDelete: (l: LinkUtil) => void; onToggle: (l: LinkUtil) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 border rounded-md bg-background">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{link.titulo}</div>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate">
          <span className="truncate">{link.url}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </a>
      </div>
      <Switch checked={link.ativo} onCheckedChange={() => onToggle(link)} />
      <Button variant="outline" size="sm" onClick={() => onEdit(link)}><Edit className="h-4 w-4" /></Button>
      <Button variant="destructive" size="sm" onClick={() => onDelete(link)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

export function LinksManager() {
  const { toast } = useToast();
  const { links, addLink, updateLink, toggleAtivo, deleteLink, reorderLinks } = useLinksUteis(false);
  const { grupos } = useLinksUteisGrupos(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LinkUtil | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkUtil | null>(null);
  const [form, setForm] = useState({ titulo: "", url: "", grupo_id: "", ativo: true });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const linksPorGrupo = useMemo(() => {
    const map = new Map<string, LinkUtil[]>();
    grupos.forEach(g => map.set(g.id, []));
    links.forEach(l => {
      if (!map.has(l.grupo_id)) map.set(l.grupo_id, []);
      map.get(l.grupo_id)!.push(l);
    });
    return map;
  }, [grupos, links]);

  const isValidUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

  const openCreate = () => {
    setEditing(null);
    setForm({ titulo: "", url: "", grupo_id: grupos[0]?.id ?? "", ativo: true });
    setDialogOpen(true);
  };
  const openEdit = (l: LinkUtil) => {
    setEditing(l);
    setForm({ titulo: l.titulo, url: l.url, grupo_id: l.grupo_id, ativo: l.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return toast({ title: "Erro", description: "Título obrigatório", variant: "destructive" });
    if (!form.url.trim() || !isValidUrl(form.url)) return toast({ title: "Erro", description: "URL inválida (use http:// ou https://)", variant: "destructive" });
    if (!form.grupo_id) return toast({ title: "Erro", description: "Selecione um grupo", variant: "destructive" });

    const ok = editing
      ? await updateLink(editing.id, form.titulo.trim(), form.url.trim(), form.ativo, form.grupo_id)
      : await addLink(form.titulo.trim(), form.url.trim(), form.grupo_id, form.ativo, (linksPorGrupo.get(form.grupo_id)?.length ?? 0));
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteLink(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  };

  const handleDragEnd = (grupoId: string) => async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const arr = linksPorGrupo.get(grupoId) ?? [];
    const oldIdx = arr.findIndex(l => l.id === active.id);
    const newIdx = arr.findIndex(l => l.id === over.id);
    const reordered = arrayMove(arr, oldIdx, newIdx);
    await reorderLinks(reordered.map((l, i) => ({ id: l.id, ordem: i })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Links</h2>
          <p className="text-sm text-muted-foreground">Arraste para reordenar dentro do grupo.</p>
        </div>
        <Button onClick={openCreate} disabled={grupos.length === 0}><Plus className="mr-2 h-4 w-4" />Novo link</Button>
      </div>

      {grupos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Crie um grupo antes de adicionar links.</div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {grupos.map(g => {
            const Icon = getIconeLink(g.icone);
            const arr = linksPorGrupo.get(g.id) ?? [];
            return (
              <AccordionItem key={g.id} value={g.id} className="border rounded-md px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{g.nome}</span>
                    <span className="text-xs text-muted-foreground">({arr.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {arr.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">Nenhum link neste grupo.</div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(g.id)}>
                      <SortableContext items={arr.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {arr.map(l => (
                            <SortableLinkRow key={l.id} link={l} onEdit={openEdit} onDelete={setDeleteTarget} onToggle={(x) => toggleAtivo(x.id, x.ativo)} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Link" : "Novo Link"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Grupo *</Label>
              <Select value={form.grupo_id} onValueChange={v => setForm(f => ({ ...f, grupo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Manual do Integrante" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label>Link ativo</Label>
            </div>
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
            <AlertDialogTitle>Excluir link</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteTarget?.titulo}"?</AlertDialogDescription>
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
