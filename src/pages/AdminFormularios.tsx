import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Power, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useFormulariosAdmin, useFormularioCRUD, useFormularioDuplicar, FormularioCatalogo } from "@/hooks/useFormulariosCatalogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRegionais } from "@/hooks/useRegionais";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ROLES_DISPONIVEIS = [
  { id: "admin", label: "Admin", color: "bg-red-500" },
  { id: "moderator", label: "Moderador", color: "bg-blue-500" },
  { id: "diretor_regional", label: "Diretor Regional", color: "bg-green-500" },
  { id: "regional", label: "Regional (Grau V)", color: "bg-teal-500" },
  { id: "diretor_divisao", label: "Diretor / Subdiretor de Divisão", color: "bg-purple-500" },
  { id: "social_divisao", label: "Social de Divisão", color: "bg-pink-500" },
  { id: "adm_divisao", label: "ADM de Divisão", color: "bg-orange-500" },
  { id: "user", label: "Usuário", color: "bg-gray-500" }
];

const AdminFormularios = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasRole } = useUserRole(user?.id);
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  const { data: formularios, isLoading } = useFormulariosAdmin();
  const { regionais } = useRegionais();
  const { create, update, toggleAtivo, isLoading: isSaving } = useFormularioCRUD();
  const { duplicate, isLoading: isDuplicating } = useFormularioDuplicar();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estado para modal de duplicação
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [formularioToDuplicate, setFormularioToDuplicate] = useState<FormularioCatalogo | null>(null);
  const [novaRegionalId, setNovaRegionalId] = useState<string>("");

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "link_interno" as "builder" | "link_interno" | "url_externa",
    link_interno: "",
    url_externa: "",
    regional_id: "",
    periodicidade: "semanal" as "diaria" | "semanal" | "mensal",
    dias_semana: [] as number[],
    limite_respostas: "multipla" as "unica" | "multipla",
    ativo: true,
    roles_permitidas: null as string[] | null,
    global: false
  });

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  const handleEdit = (formulario: FormularioCatalogo) => {
    setIsEditing(true);
    setEditingId(formulario.id);
    setFormData({
      titulo: formulario.titulo,
      descricao: formulario.descricao || "",
      tipo: formulario.tipo,
      link_interno: formulario.link_interno || "",
      url_externa: formulario.url_externa || "",
      regional_id: formulario.regional_id,
      periodicidade: formulario.periodicidade,
      dias_semana: formulario.dias_semana || [],
      limite_respostas: formulario.limite_respostas,
      ativo: formulario.ativo ?? true,
      roles_permitidas: formulario.roles_permitidas,
      global: formulario.global ?? false
    });
  };

  const handleSubmit = () => {
    // Garantir que apenas o campo correto está preenchido baseado no tipo
    const dadosLimpos = {
      ...formData,
      link_interno: formData.tipo === 'link_interno' ? formData.link_interno : null,
      url_externa: formData.tipo === 'url_externa' ? formData.url_externa : null,
    };

    if (isEditing && editingId) {
      update({ id: editingId, ...dadosLimpos });
    } else {
      create(dadosLimpos);
    }
    resetForm();
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      titulo: "",
      descricao: "",
      tipo: "link_interno",
      link_interno: "",
      url_externa: "",
      regional_id: "",
      periodicidade: "semanal",
      dias_semana: [],
      limite_respostas: "multipla",
      ativo: true,
      roles_permitidas: null,
      global: false
    });
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => {
      const current = prev.roles_permitidas || [];
      
      if (current.includes(roleId)) {
        // Remover role
        const newRoles = current.filter(r => r !== roleId);
        return {
          ...prev,
          roles_permitidas: newRoles.length === 0 ? null : newRoles
        };
      } else {
        // Adicionar role
        return {
          ...prev,
          roles_permitidas: [...current, roleId]
        };
      }
    });
  };

  // Funções para duplicação
  const handleOpenDuplicateModal = (form: FormularioCatalogo) => {
    setFormularioToDuplicate(form);
    setNovaRegionalId("");
    setDuplicateModalOpen(true);
  };

  const handleDuplicate = () => {
    if (formularioToDuplicate && novaRegionalId) {
      duplicate({ formulario: formularioToDuplicate, novaRegionalId });
      setDuplicateModalOpen(false);
      setFormularioToDuplicate(null);
      setNovaRegionalId("");
    }
  };

  if (loadingAccess || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  const diasSemanaNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Administração de Formulários</h1>
            <p className="text-sm text-muted-foreground">Gerenciar formulários do portal</p>
          </div>
        </div>

        {/* Formulário de criação/edição */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isEditing ? "Editar Formulário" : "Criar Novo Formulário"}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Nome do formulário"
                />
              </div>
              <div className="space-y-2">
                <Label>Regional *</Label>
                <Select value={formData.regional_id} onValueChange={(v) => setFormData({ ...formData, regional_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a regional" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionais?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do formulário"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(v: 'builder' | 'link_interno' | 'url_externa') => {
                    // Limpar campos de URL ao mudar tipo para evitar dados órfãos
                    if (v === 'link_interno') {
                      setFormData({ ...formData, tipo: v, url_externa: '' });
                    } else if (v === 'url_externa') {
                      setFormData({ ...formData, tipo: v, link_interno: '' });
                    } else {
                      setFormData({ ...formData, tipo: v, link_interno: '', url_externa: '' });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link_interno">Link Interno</SelectItem>
                    <SelectItem value="url_externa">URL Externa</SelectItem>
                    <SelectItem value="builder">Builder (futuro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Periodicidade</Label>
                <Select value={formData.periodicidade} onValueChange={(v: any) => setFormData({ ...formData, periodicidade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Limite de Respostas</Label>
                <Select value={formData.limite_respostas} onValueChange={(v: any) => setFormData({ ...formData, limite_respostas: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="multipla">Múltipla</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.tipo === "link_interno" && (
              <div className="space-y-2">
                <Label>Link Interno</Label>
                <Input
                  value={formData.link_interno}
                  onChange={(e) => setFormData({ ...formData, link_interno: e.target.value })}
                  placeholder="/formularios/nome-do-formulario"
                />
              </div>
            )}

            {formData.tipo === "url_externa" && (
              <div className="space-y-2">
                <Label>URL Externa</Label>
                <Input
                  value={formData.url_externa}
                  onChange={(e) => setFormData({ ...formData, url_externa: e.target.value })}
                  placeholder="https://forms.gle/..."
                />
              </div>
            )}

            {formData.periodicidade === "semanal" && (
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex gap-2">
                  {diasSemanaNomes.map((dia, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant={formData.dias_semana.includes(idx) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const novo = formData.dias_semana.includes(idx)
                          ? formData.dias_semana.filter(d => d !== idx)
                          : [...formData.dias_semana, idx];
                        setFormData({ ...formData, dias_semana: novo });
                      }}
                    >
                      {dia}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Permissões de Acesso (Roles) */}
            <div className="space-y-2">
              <Label>Permissões de Acesso (Roles)</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione as roles que podem acessar este formulário. 
                Se nenhuma for selecionada, todos da regional terão acesso.
              </p>
              
              <div className="flex flex-wrap gap-2">
                {ROLES_DISPONIVEIS.map(role => {
                  const isSelected = formData.roles_permitidas?.includes(role.id) || false;
                  
                  return (
                    <Button
                      key={role.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={isSelected ? `${role.color} text-white hover:opacity-90` : ""}
                      onClick={() => toggleRole(role.id)}
                    >
                      {isSelected && "✓ "}
                      {role.label}
                    </Button>
                  );
                })}
              </div>
              
              {/* Indicador visual de "acesso liberado para todos" */}
              {(!formData.roles_permitidas || formData.roles_permitidas.length === 0) && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  ℹ️ Nenhuma role selecionada = <strong>todos os usuários da regional</strong> terão acesso
                </div>
              )}
            </div>

            {/* Switch Global */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.global} 
                  onCheckedChange={(v) => setFormData({ ...formData, global: v })} 
                />
                <Label>Formulário Global (todas as regionais)</Label>
              </div>
              
              {formData.global && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
                  🌐 Este formulário aparecerá para todas as regionais que tenham usuários com as roles permitidas.
                  A regional selecionada indica apenas quem administra o formulário.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} />
              <Label>Ativo</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isSaving || !formData.titulo || !formData.regional_id}>
                {isEditing ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {isEditing ? "Atualizar" : "Criar"}
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Grid de formulários */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Formulários Cadastrados</h2>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <div className="space-y-3">
              {formularios?.map((form) => (
                <div key={form.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{form.titulo}</h3>
                      {form.global && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700">
                          🌐 Global
                        </Badge>
                      )}
                      <Badge variant={form.ativo ? "default" : "secondary"}>
                        {form.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">{form.tipo}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{form.descricao}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span>Regional: {form.regionais?.nome}</span>
                      <span>Periodicidade: {form.periodicidade}</span>
                      <span>Criado: {format(new Date(form.created_at), "dd/MM/yyyy")}</span>
                    </div>
                    
                    {/* Exibir roles permitidas */}
                    {form.roles_permitidas && form.roles_permitidas.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Acesso:</span>
                        {form.roles_permitidas.map(roleId => {
                          const roleConfig = ROLES_DISPONIVEIS.find(r => r.id === roleId);
                          if (!roleConfig) return null;
                          
                          return (
                            <Badge 
                              key={roleId} 
                              className={`${roleConfig.color} text-white text-xs`}
                            >
                              {roleConfig.label}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Acesso: </span>
                        <Badge variant="outline" className="text-xs">
                          Todos da regional
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleOpenDuplicateModal(form)}
                      title="Duplicar para outra regional"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(form)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleAtivo({ id: form.id, ativo: !form.ativo })}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Modal de Duplicação */}
        <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicar Formulário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Duplicando: <strong>{formularioToDuplicate?.titulo}</strong>
              </p>
              <div className="space-y-2">
                <Label>Selecione a nova regional *</Label>
                <Select value={novaRegionalId} onValueChange={setNovaRegionalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a regional de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionais
                      ?.filter(r => r.id !== formularioToDuplicate?.regional_id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleDuplicate} disabled={!novaRegionalId || isDuplicating}>
                {isDuplicating ? "Duplicando..." : "Duplicar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminFormularios;
