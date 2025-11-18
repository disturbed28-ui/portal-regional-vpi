import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTiposDelta } from "@/hooks/useTiposDelta";
import { useAcoesResolucaoDelta } from "@/hooks/useAcoesResolucaoDelta";
import { useAcoesResolucaoDeltaAdmin } from "@/hooks/useAcoesResolucaoDeltaAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export const ConfiguracaoAcoesResolucao = () => {
  const { tiposDelta, isLoading: loadingTipos } = useTiposDelta();
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('');
  const { acoes, isLoading: loadingAcoes } = useAcoesResolucaoDelta(tipoSelecionado);
  const { create, update, delete: deleteAcao } = useAcoesResolucaoDeltaAdmin();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    codigo_acao: '',
    label: '',
    descricao: '',
  });

  const handleEdit = (acao: any) => {
    setEditingId(acao.id);
    setEditForm({
      label: acao.label,
      descricao: acao.descricao || '',
    });
  };

  const handleSave = async (id: string) => {
    try {
      await update({ id, ...editForm });
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta ação?')) {
      try {
        await deleteAcao(id);
      } catch (error) {
        console.error('Erro ao excluir:', error);
      }
    }
  };

  const handleCreate = async () => {
    if (!tipoSelecionado || !newForm.codigo_acao || !newForm.label) {
      return;
    }

    try {
      await create({
        tipo_delta_codigo: tipoSelecionado,
        codigo_acao: newForm.codigo_acao,
        label: newForm.label,
        descricao: newForm.descricao,
        ordem: acoes.length,
        ativo: true,
      });
      setShowNewForm(false);
      setNewForm({ codigo_acao: '', label: '', descricao: '' });
    } catch (error) {
      console.error('Erro ao criar:', error);
    }
  };

  if (loadingTipos) {
    return <Skeleton className="h-64 w-full" />;
  }

  const tipoAtual = tiposDelta.find(t => t.codigo === tipoSelecionado);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações de Resolução</CardTitle>
        <CardDescription>
          Configure as ações disponíveis para resolver cada tipo de delta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Selecione o Tipo de Delta</Label>
          <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um tipo de delta" />
            </SelectTrigger>
            <SelectContent>
              {tiposDelta.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.codigo}>
                  <div className="flex items-center gap-2">
                    <span>{tipo.icone}</span>
                    <span>{tipo.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipoSelecionado && tipoAtual && (
          <>
            <div className="flex items-center justify-between">
              <Badge style={{ backgroundColor: tipoAtual.cor }} className="text-lg px-3 py-1">
                {tipoAtual.icone} {tipoAtual.nome}
              </Badge>
              <Button onClick={() => setShowNewForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Ação
              </Button>
            </div>

            {showNewForm && (
              <Card className="border-2 border-primary">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Código da Ação</Label>
                    <Input
                      value={newForm.codigo_acao}
                      onChange={(e) => setNewForm({ ...newForm, codigo_acao: e.target.value })}
                      placeholder="Ex: transferido"
                    />
                  </div>
                  <div>
                    <Label>Label (com emoji)</Label>
                    <Input
                      value={newForm.label}
                      onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
                      placeholder="Ex: 📤 Transferido para outra divisão"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={newForm.descricao}
                      onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })}
                      placeholder="Descrição detalhada da ação"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate}>Criar</Button>
                    <Button onClick={() => setShowNewForm(false)} variant="outline">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingAcoes ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {acoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma ação cadastrada para este tipo de delta.
                  </p>
                ) : (
                  acoes.map((acao) => (
                    <Card key={acao.id}>
                      <CardContent className="pt-6">
                        {editingId === acao.id ? (
                          <div className="space-y-3">
                            <div>
                              <Label>Label</Label>
                              <Input
                                value={editForm.label}
                                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Descrição</Label>
                              <Textarea
                                value={editForm.descricao}
                                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => handleSave(acao.id)} size="sm">
                                <Save className="h-4 w-4 mr-2" />
                                Salvar
                              </Button>
                              <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                              <div className="flex-1">
                                <div className="font-medium">{acao.label}</div>
                                {acao.descricao && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {acao.descricao}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-2">
                                  Código: <code>{acao.codigo_acao}</code>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => handleEdit(acao)} variant="outline" size="sm">
                                Editar
                              </Button>
                              <Button 
                                onClick={() => handleDelete(acao.id)} 
                                variant="destructive" 
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
