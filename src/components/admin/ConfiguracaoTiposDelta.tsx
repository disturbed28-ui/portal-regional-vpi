import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTiposDeltaAdminList } from "@/hooks/useTiposDelta";
import { useTiposDeltaAdmin } from "@/hooks/useTiposDeltaAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const ConfiguracaoTiposDelta = () => {
  const { tiposDelta, isLoading } = useTiposDeltaAdminList();
  const { update } = useTiposDeltaAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const handleEdit = (tipo: any) => {
    setEditingId(tipo.id);
    setEditForm({
      nome: tipo.nome,
      descricao: tipo.descricao || '',
      icone: tipo.icone,
      cor: tipo.cor,
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

  const handleToggleAtivo = async (tipo: any) => {
    try {
      await update({ id: tipo.id, ativo: !tipo.ativo });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de Delta</CardTitle>
        <CardDescription>
          Configure os tipos de delta que são gerados durante as cargas de dados.
          Tipos bloqueados não podem ser excluídos pois são essenciais para o sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tiposDelta.map((tipo) => (
            <Card key={tipo.id} className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge 
                        className="text-lg px-3 py-1"
                        style={{ backgroundColor: tipo.cor }}
                      >
                        {tipo.icone} {tipo.codigo}
                      </Badge>
                      {tipo.bloqueado && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Bloqueado
                        </Badge>
                      )}
                      {!tipo.ativo && (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                      <Switch
                        checked={tipo.ativo}
                        onCheckedChange={() => handleToggleAtivo(tipo)}
                      />
                    </div>

                    {editingId === tipo.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editForm.nome}
                            onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Descrição</Label>
                          <Textarea
                            value={editForm.descricao}
                            onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Ícone (emoji)</Label>
                            <Input
                              value={editForm.icone}
                              onChange={(e) => setEditForm({ ...editForm, icone: e.target.value })}
                              maxLength={2}
                            />
                          </div>
                          <div>
                            <Label>Cor (hex)</Label>
                            <Input
                              type="color"
                              value={editForm.cor}
                              onChange={(e) => setEditForm({ ...editForm, cor: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleSave(tipo.id)} size="sm">
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                          <Button 
                            onClick={() => setEditingId(null)} 
                            variant="outline" 
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">{tipo.nome}</h3>
                        <p className="text-sm text-muted-foreground">{tipo.descricao}</p>
                        <Button 
                          onClick={() => handleEdit(tipo)} 
                          variant="outline" 
                          size="sm"
                          className="mt-2"
                        >
                          Editar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
