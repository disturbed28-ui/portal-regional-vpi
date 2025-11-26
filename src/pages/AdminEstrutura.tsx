import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useComandos, Comando } from "@/hooks/useComandos";
import { useRegionais, Regional } from "@/hooks/useRegionais";
import { useDivisoes, Divisao } from "@/hooks/useDivisoes";
import { ArrowLeft } from "lucide-react";
import {
  createComando,
  updateComando,
  deleteComando,
  createRegional,
  updateRegional,
  deleteRegional,
  createDivisao,
  updateDivisao,
  deleteDivisao,
} from "@/lib/adminCrud";

const AdminEstrutura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole(user?.id);

  // Estado dos diálogos
  const [comandoDialogOpen, setComandoDialogOpen] = useState(false);
  const [regionalDialogOpen, setRegionalDialogOpen] = useState(false);
  const [divisaoDialogOpen, setDivisaoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Estado dos formulários
  const [comandoForm, setComandoForm] = useState({ id: '', nome: '' });
  const [regionalForm, setRegionalForm] = useState({ id: '', nome: '', comando_id: '' });
  const [divisaoForm, setDivisaoForm] = useState({ id: '', nome: '', regional_id: '' });

  // Estado de exclusão
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'comando' | 'regional' | 'divisao'; id: string; nome: string } | null>(null);

  // Filtros
  const [selectedComandoFilter, setSelectedComandoFilter] = useState<string>('');
  const [selectedRegionalFilter, setSelectedRegionalFilter] = useState<string>('');

  // Hooks de dados
  const { comandos, loading: comandosLoading } = useComandos();
  const { regionais: allRegionais } = useRegionais();
  const { divisoes: allDivisoes } = useDivisoes();

  // Filtrar regionais e divisões baseado nos filtros
  const filteredRegionais = selectedComandoFilter
    ? allRegionais.filter(r => r.comando_id === selectedComandoFilter)
    : allRegionais;

  const filteredDivisoes = selectedRegionalFilter
    ? allDivisoes.filter(d => d.regional_id === selectedRegionalFilter)
    : allDivisoes;

  // Verificar acesso admin
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

  // === COMANDO CRUD ===
  const openComandoDialog = (comando?: Comando) => {
    if (comando) {
      setComandoForm({ id: comando.id, nome: comando.nome });
    } else {
      setComandoForm({ id: '', nome: '' });
    }
    setComandoDialogOpen(true);
  };

  const handleComandoSubmit = async () => {
    if (!comandoForm.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome do comando é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      if (comandoForm.id) {
        await updateComando(comandoForm.id, comandoForm.nome);
        toast({ title: "Comando atualizado com sucesso" });
      } else {
        await createComando(comandoForm.nome);
        toast({ title: "Comando criado com sucesso" });
      }
      setComandoDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar comando",
        variant: "destructive",
      });
    }
  };

  // === REGIONAL CRUD ===
  const openRegionalDialog = (regional?: Regional) => {
    if (regional) {
      setRegionalForm({ id: regional.id, nome: regional.nome, comando_id: regional.comando_id });
    } else {
      setRegionalForm({ id: '', nome: '', comando_id: selectedComandoFilter || '' });
    }
    setRegionalDialogOpen(true);
  };

  const handleRegionalSubmit = async () => {
    if (!regionalForm.nome.trim() || !regionalForm.comando_id) {
      toast({
        title: "Erro",
        description: "Nome e comando são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (regionalForm.id) {
        await updateRegional(regionalForm.id, regionalForm.nome, regionalForm.comando_id);
        toast({ title: "Regional atualizada com sucesso" });
      } else {
        await createRegional(regionalForm.nome, regionalForm.comando_id);
        toast({ title: "Regional criada com sucesso" });
      }
      setRegionalDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar regional",
        variant: "destructive",
      });
    }
  };

  // === DIVISAO CRUD ===
  const openDivisaoDialog = (divisao?: Divisao) => {
    if (divisao) {
      setDivisaoForm({ id: divisao.id, nome: divisao.nome, regional_id: divisao.regional_id });
    } else {
      setDivisaoForm({ id: '', nome: '', regional_id: selectedRegionalFilter || '' });
    }
    setDivisaoDialogOpen(true);
  };

  const handleDivisaoSubmit = async () => {
    if (!divisaoForm.nome.trim() || !divisaoForm.regional_id) {
      toast({
        title: "Erro",
        description: "Nome e regional são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (divisaoForm.id) {
        await updateDivisao(divisaoForm.id, divisaoForm.nome, divisaoForm.regional_id);
        toast({ title: "Divisao atualizada com sucesso" });
      } else {
        await createDivisao(divisaoForm.nome, divisaoForm.regional_id);
        toast({ title: "Divisao criada com sucesso" });
      }
      setDivisaoDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar divisao",
        variant: "destructive",
      });
    }
  };

  // === DELETE ===
  const confirmDelete = (type: 'comando' | 'regional' | 'divisao', id: string, nome: string) => {
    setDeleteTarget({ type, id, nome });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'comando') {
        await deleteComando(deleteTarget.id);
      } else if (deleteTarget.type === 'regional') {
        await deleteRegional(deleteTarget.id);
      } else {
        await deleteDivisao(deleteTarget.id);
      }
      toast({ title: `${deleteTarget.type} excluído com sucesso` });
      setDeleteDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir",
        variant: "destructive",
      });
    }
  };

  if (authLoading || roleLoading || comandosLoading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="admin-page min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Estrutura Organizacional</h1>
            <p className="text-sm text-muted-foreground">Gerencie comandos, regionais e divisões</p>
          </div>
        </div>

        <Tabs defaultValue="comandos" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comandos">Comandos</TabsTrigger>
            <TabsTrigger value="regionais">Regionais</TabsTrigger>
            <TabsTrigger value="divisoes">Divisoes</TabsTrigger>
          </TabsList>

          {/* Tab Comandos */}
          <TabsContent value="comandos" className="mt-4 space-y-4">
            <Button onClick={() => openComandoDialog()}>+ Novo Comando</Button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comandos.map((comando) => (
                <Card key={comando.id}>
                  <CardHeader>
                    <CardTitle>{comando.nome}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openComandoDialog(comando)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDelete('comando', comando.id, comando.nome)}
                    >
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Regionais */}
          <TabsContent value="regionais" className="mt-4 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Filtrar por Comando</Label>
                <Select value={selectedComandoFilter} onValueChange={setSelectedComandoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os comandos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {comandos.map((cmd) => (
                      <SelectItem key={cmd.id} value={cmd.id}>
                        {cmd.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openRegionalDialog()}>+ Nova Regional</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegionais.map((regional) => (
                <Card key={regional.id}>
                  <CardHeader>
                    <CardTitle>{regional.nome}</CardTitle>
                    <CardDescription>
                      {comandos.find(c => c.id === regional.comando_id)?.nome}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openRegionalDialog(regional)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDelete('regional', regional.id, regional.nome)}
                    >
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Divisões */}
          <TabsContent value="divisoes" className="mt-4 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Filtrar por Regional</Label>
                <Select value={selectedRegionalFilter} onValueChange={setSelectedRegionalFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as regionais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {allRegionais.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openDivisaoDialog()}>+ Nova Divisao</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDivisoes.map((divisao) => (
                <Card key={divisao.id}>
                  <CardHeader>
                    <CardTitle>{divisao.nome}</CardTitle>
                    <CardDescription>
                      {allRegionais.find(r => r.id === divisao.regional_id)?.nome}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDivisaoDialog(divisao)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDelete('divisao', divisao.id, divisao.nome)}
                    >
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Comando */}
        <Dialog open={comandoDialogOpen} onOpenChange={setComandoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{comandoForm.id ? 'Editar' : 'Novo'} Comando</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comando-nome">Nome do Comando</Label>
                <Input
                  id="comando-nome"
                  value={comandoForm.nome}
                  onChange={(e) => setComandoForm({ ...comandoForm, nome: e.target.value })}
                  placeholder="Ex: Comando Central"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComandoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleComandoSubmit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Regional */}
        <Dialog open={regionalDialogOpen} onOpenChange={setRegionalDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{regionalForm.id ? 'Editar' : 'Nova'} Regional</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="regional-comando">Comando</Label>
                <Select
                  value={regionalForm.comando_id}
                  onValueChange={(value) => setRegionalForm({ ...regionalForm, comando_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o comando" />
                  </SelectTrigger>
                  <SelectContent>
                    {comandos.map((cmd) => (
                      <SelectItem key={cmd.id} value={cmd.id}>
                        {cmd.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regional-nome">Nome da Regional</Label>
                <Input
                  id="regional-nome"
                  value={regionalForm.nome}
                  onChange={(e) => setRegionalForm({ ...regionalForm, nome: e.target.value })}
                  placeholder="Ex: Regional Leste"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegionalDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRegionalSubmit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Divisão */}
        <Dialog open={divisaoDialogOpen} onOpenChange={setDivisaoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{divisaoForm.id ? 'Editar' : 'Nova'} Divisao</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="divisao-regional">Regional</Label>
                <Select
                  value={divisaoForm.regional_id}
                  onValueChange={(value) => setDivisaoForm({ ...divisaoForm, regional_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a regional" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRegionais.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="divisao-nome">Nome da Divisao</Label>
                <Input
                  id="divisao-nome"
                  value={divisaoForm.nome}
                  onChange={(e) => setDivisaoForm({ ...divisaoForm, nome: e.target.value })}
                  placeholder="Ex: Divisao Sul"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDivisaoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleDivisaoSubmit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert Dialog Delete */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AdminEstrutura;
