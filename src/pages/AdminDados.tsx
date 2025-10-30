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
import { useCargos, Cargo } from "@/hooks/useCargos";
import { useFuncoes, Funcao } from "@/hooks/useFuncoes";
import {
  createCargo,
  updateCargo,
  deleteCargo,
  createFuncao,
  updateFuncao,
  deleteFuncao,
} from "@/lib/adminCrud";

const GRAU_OPTIONS = ['X', 'IX', 'VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I', 'Camiseta'];

const AdminDados = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useUserRole(user?.uid);

  // Estado dos diálogos
  const [cargoDialogOpen, setCargoDialogOpen] = useState(false);
  const [funcaoDialogOpen, setFuncaoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Estado dos formulários
  const [cargoForm, setCargoForm] = useState({ id: '', grau: '', nome: '', nivel: '' });
  const [funcaoForm, setFuncaoForm] = useState({ id: '', nome: '', ordem: '' });

  // Estado de exclusão
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'cargo' | 'funcao'; id: string; nome: string } | null>(null);

  // Hooks de dados
  const { cargos, loading: cargosLoading } = useCargos();
  const { funcoes, loading: funcoesLoading } = useFuncoes();

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

  // === CARGO CRUD ===
  const openCargoDialog = (cargo?: Cargo) => {
    if (cargo) {
      setCargoForm({
        id: cargo.id,
        grau: cargo.grau,
        nome: cargo.nome,
        nivel: cargo.nivel?.toString() || '',
      });
    } else {
      setCargoForm({ id: '', grau: '', nome: '', nivel: '' });
    }
    setCargoDialogOpen(true);
  };

  const handleCargoSubmit = async () => {
    if (!cargoForm.grau || !cargoForm.nome.trim()) {
      toast({
        title: "Erro",
        description: "Grau e nome são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const nivel = cargoForm.nivel ? parseInt(cargoForm.nivel) : null;
      if (cargoForm.id) {
        await updateCargo(cargoForm.id, cargoForm.grau, cargoForm.nome, nivel);
        toast({ title: "Cargo atualizado com sucesso" });
      } else {
        await createCargo(cargoForm.grau, cargoForm.nome, nivel);
        toast({ title: "Cargo criado com sucesso" });
      }
      setCargoDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar cargo",
        variant: "destructive",
      });
    }
  };

  // === FUNCAO CRUD ===
  const openFuncaoDialog = (funcao?: Funcao) => {
    if (funcao) {
      setFuncaoForm({
        id: funcao.id,
        nome: funcao.nome,
        ordem: funcao.ordem?.toString() || '',
      });
    } else {
      setFuncaoForm({ id: '', nome: '', ordem: '' });
    }
    setFuncaoDialogOpen(true);
  };

  const handleFuncaoSubmit = async () => {
    if (!funcaoForm.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const ordem = funcaoForm.ordem ? parseInt(funcaoForm.ordem) : null;
      if (funcaoForm.id) {
        await updateFuncao(funcaoForm.id, funcaoForm.nome, ordem);
        toast({ title: "Funcao atualizada com sucesso" });
      } else {
        await createFuncao(funcaoForm.nome, ordem);
        toast({ title: "Funcao criada com sucesso" });
      }
      setFuncaoDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar funcao",
        variant: "destructive",
      });
    }
  };

  // === DELETE ===
  const confirmDelete = (type: 'cargo' | 'funcao', id: string, nome: string) => {
    setDeleteTarget({ type, id, nome });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'cargo') {
        await deleteCargo(deleteTarget.id);
      } else {
        await deleteFuncao(deleteTarget.id);
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

  if (authLoading || roleLoading || cargosLoading || funcoesLoading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="admin-page min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Gestao de Dados Administrativos</h1>
          <Button onClick={() => navigate("/admin")} variant="outline">
            Voltar
          </Button>
        </div>

        <Tabs defaultValue="cargos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cargos">Cargos</TabsTrigger>
            <TabsTrigger value="funcoes">Funcoes</TabsTrigger>
          </TabsList>

          {/* Tab Cargos */}
          <TabsContent value="cargos" className="mt-4 space-y-4">
            <Button onClick={() => openCargoDialog()}>+ Novo Cargo</Button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cargos.map((cargo) => (
                <Card key={cargo.id}>
                  <CardHeader>
                    <CardTitle>{cargo.nome}</CardTitle>
                    <CardDescription>
                      Grau: {cargo.grau} | Nível: {cargo.nivel || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openCargoDialog(cargo)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDelete('cargo', cargo.id, cargo.nome)}
                    >
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab Funções */}
          <TabsContent value="funcoes" className="mt-4 space-y-4">
            <Button onClick={() => openFuncaoDialog()}>+ Nova Funcao</Button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funcoes.map((funcao) => (
                <Card key={funcao.id}>
                  <CardHeader>
                    <CardTitle>{funcao.nome}</CardTitle>
                    <CardDescription>Ordem: {funcao.ordem || 'N/A'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openFuncaoDialog(funcao)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDelete('funcao', funcao.id, funcao.nome)}
                    >
                      Excluir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog Cargo */}
        <Dialog open={cargoDialogOpen} onOpenChange={setCargoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{cargoForm.id ? 'Editar' : 'Novo'} Cargo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cargo-grau">Grau</Label>
                <Select
                  value={cargoForm.grau}
                  onValueChange={(value) => setCargoForm({ ...cargoForm, grau: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAU_OPTIONS.map((grau) => (
                      <SelectItem key={grau} value={grau}>
                        {grau}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo-nome">Nome do Cargo</Label>
                <Input
                  id="cargo-nome"
                  value={cargoForm.nome}
                  onChange={(e) => setCargoForm({ ...cargoForm, nome: e.target.value })}
                  placeholder="Ex: Diretor de Divisao"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo-nivel">Nível (Hierarquia)</Label>
                <Input
                  id="cargo-nivel"
                  type="number"
                  value={cargoForm.nivel}
                  onChange={(e) => setCargoForm({ ...cargoForm, nivel: e.target.value })}
                  placeholder="Ex: 6"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCargoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCargoSubmit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Função */}
        <Dialog open={funcaoDialogOpen} onOpenChange={setFuncaoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{funcaoForm.id ? 'Editar' : 'Nova'} Funcao</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="funcao-nome">Nome da Funcao</Label>
                <Input
                  id="funcao-nome"
                  value={funcaoForm.nome}
                  onChange={(e) => setFuncaoForm({ ...funcaoForm, nome: e.target.value })}
                  placeholder="Ex: Tesoureiro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funcao-ordem">Ordem (para ordenação)</Label>
                <Input
                  id="funcao-ordem"
                  type="number"
                  value={funcaoForm.ordem}
                  onChange={(e) => setFuncaoForm({ ...funcaoForm, ordem: e.target.value })}
                  placeholder="Ex: 1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFuncaoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleFuncaoSubmit}>Salvar</Button>
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

export default AdminDados;
