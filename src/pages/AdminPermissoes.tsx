import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Shield, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ROLES = [
  { value: 'admin' as const, label: 'Admin', color: 'bg-red-500' },
  { value: 'moderator' as const, label: 'Moderador', color: 'bg-blue-500' },
  { value: 'diretor_divisao' as const, label: 'Diretor / Subdiretor de Divisão', color: 'bg-purple-500' },
  { value: 'user' as const, label: 'Usuário', color: 'bg-gray-500' },
];

export default function AdminPermissoes() {
  const navigate = useNavigate();
  const { screens, loading, togglePermission, hasPermission, isOperationLoading, refetch } = useScreenPermissions();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Permissões</h1>
            <p className="text-muted-foreground">
              Controle quais perfis têm acesso a cada tela do sistema
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matriz de Permissões</CardTitle>
          <CardDescription>
            Marque as caixas para conceder acesso. Desmarque para remover.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Tela</TableHead>
                  {ROLES.map(role => (
                    <TableHead key={role.value} className="text-center">
                      <Badge className={`${role.color} text-white`}>
                        {role.label}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {screens.map(screen => (
                  <TableRow key={screen.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{screen.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          {screen.rota}
                        </div>
                        {screen.descricao && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {screen.descricao}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {ROLES.map(role => (
                      <TableCell key={role.value} className="text-center">
                        <div className="flex justify-center items-center gap-2">
                          {isOperationLoading(screen.id, role.value) ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Checkbox
                              checked={hasPermission(screen.id, role.value)}
                              onCheckedChange={() => {
                                console.log('[AdminPermissoes] Checkbox clicado:', {
                                  screen: screen.nome,
                                  role: role.value,
                                  currentState: hasPermission(screen.id, role.value)
                                });
                                togglePermission(screen.id, role.value);
                              }}
                              disabled={isOperationLoading(screen.id, role.value)}
                            />
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legenda de Perfis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map(role => (
              <div key={role.value} className="flex items-center gap-2">
                <Badge className={`${role.color} text-white`}>
                  {role.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {role.value === 'admin' && 'Acesso total ao sistema'}
                  {role.value === 'moderator' && 'Gerencia integrantes e eventos'}
                  {role.value === 'diretor_divisao' && 'Gerencia divisão e visualiza relatórios'}
                  {role.value === 'user' && 'Acesso básico'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
