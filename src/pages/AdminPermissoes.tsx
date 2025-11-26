import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Shield, Loader2, RefreshCw, ArrowLeft } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ROLES = [
  { value: 'admin' as const, label: 'Admin', color: 'bg-red-500' },
  { value: 'moderator' as const, label: 'Moderador', color: 'bg-blue-500' },
  { value: 'diretor_regional' as const, label: 'Diretor Regional', color: 'bg-green-500' },
  { value: 'regional' as const, label: 'Regional', color: 'bg-teal-500' },
  { value: 'diretor_divisao' as const, label: 'Diretor / Subdiretor de Divisão', color: 'bg-purple-500' },
  { value: 'user' as const, label: 'Usuário', color: 'bg-gray-500' },
];

export default function AdminPermissoes() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Gerenciamento de Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Controle quais perfis têm acesso a cada tela do sistema
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
          {isMobile ? (
            <Accordion type="single" collapsible className="w-full">
              {screens.map(screen => (
                <AccordionItem key={screen.id} value={screen.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col items-start text-left w-full pr-2">
                      <div className="font-medium">{screen.nome}</div>
                      <div className="text-xs text-muted-foreground">{screen.rota}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {ROLES.map(role => (
                        <div key={role.value} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            {isOperationLoading(screen.id, role.value) ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <Checkbox
                                checked={hasPermission(screen.id, role.value)}
                                onCheckedChange={() => togglePermission(screen.id, role.value)}
                                disabled={isOperationLoading(screen.id, role.value)}
                              />
                            )}
                            <span className="text-sm font-medium">{role.label}</span>
                          </div>
                          <Badge className={`${role.color} text-white text-xs`}>
                            {role.value}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="overflow-auto max-h-[60vh] border rounded-md">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[300px] bg-background">
                      Tela
                    </th>
                    {ROLES.map(role => (
                      <th key={role.value} className="h-12 px-4 text-center align-middle font-medium text-muted-foreground bg-background">
                        <Badge className={`${role.color} text-white`}>
                          {role.label}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {screens.map(screen => (
                    <tr key={screen.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">
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
                      </td>
                      {ROLES.map(role => (
                        <td key={role.value} className="p-4 align-middle text-center">
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
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                          {role.value === 'diretor_regional' && 'Gerencia regional e visualiza relatórios'}
                          {role.value === 'regional' && 'Gerencia regional (role legada)'}
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
