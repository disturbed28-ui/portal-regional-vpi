import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useLinksUteis, LinkUtil } from "@/hooks/useLinksUteis";
import { Edit, Trash2, Plus, ExternalLink } from "lucide-react";

const AdminLinksUteis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useScreenAccess('/admin/links-uteis', user?.id);
  const { links, loading, addLink, updateLink, toggleAtivo, deleteLink } = useLinksUteis(false);

  // ===== DEBUG: Log detalhado de permissão =====
  useEffect(() => {
    console.log("[AdminLinksUteis] ===== PERMISSÃO DEBUG =====", {
      pathAtual: window.location.pathname,
      routeUsada: '/admin/links-uteis',
      userId: user?.id,
      hasAccess,
      accessLoading,
      authLoading,
      timestamp: new Date().toISOString()
    });
  }, [user, hasAccess, accessLoading, authLoading]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkUtil | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkUtil | null>(null);
  
  const [formData, setFormData] = useState({
    titulo: "",
    url: "",
    ativo: true,
  });

  useEffect(() => {
    if (authLoading || accessLoading) return;

    if (!user || !hasAccess) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, hasAccess, authLoading, accessLoading, navigate, toast]);

  const isValidUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const openDialog = (link?: LinkUtil) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        titulo: link.titulo,
        url: link.url,
        ativo: link.ativo,
      });
    } else {
      setEditingLink(null);
      setFormData({ titulo: "", url: "", ativo: true });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.url.trim()) {
      toast({
        title: "Erro",
        description: "URL é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUrl(formData.url)) {
      toast({
        title: "Erro",
        description: "URL deve começar com http:// ou https://",
        variant: "destructive",
      });
      return;
    }

    const success = editingLink
      ? await updateLink(editingLink.id, formData.titulo, formData.url, formData.ativo)
      : await addLink(formData.titulo, formData.url, formData.ativo);

    if (success) {
      setDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    const success = await deleteLink(deleteTarget.id);
    if (success) {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleAtivo = async (link: LinkUtil) => {
    await toggleAtivo(link.id, link.ativo);
  };

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white">Verificando permissões...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Gestão de Links Úteis</CardTitle>
              <CardDescription>Gerencie os links úteis exibidos no portal</CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum link cadastrado. Clique em "Adicionar Link" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.titulo}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1 group"
                        title={link.url}
                      >
                        <span className="truncate">{link.url}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={link.ativo}
                        onCheckedChange={() => handleToggleAtivo(link)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog(link)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(link);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-6">
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Voltar ao Painel Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? "Editar Link" : "Adicionar Novo Link"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Portal do Colaborador"
              />
            </div>
            <div>
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://exemplo.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL deve começar com http:// ou https://
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Link ativo (visível no portal)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingLink ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o link "{deleteTarget?.titulo}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminLinksUteis;
