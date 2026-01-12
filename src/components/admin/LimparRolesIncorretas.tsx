import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Play, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface RelatorioItem {
  user_id: string;
  nome_colete: string;
  grau: string | null;
  cargo_nome: string | null;
  divisao_texto: string | null;
  roles_antes: string[];
  roles_depois: string[];
  acao: string;
}

interface ResultadoLimpeza {
  sucesso: boolean;
  modo: string;
  resumo: {
    total_analisados: number;
    total_alterados: number;
    roles_removidas: number;
    roles_adicionadas: number;
    sem_alteracao: number;
  };
  relatorio: RelatorioItem[];
}

export function LimparRolesIncorretas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLimpeza | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const executarLimpeza = async (modo: 'relatorio' | 'executar') => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/limpar-roles-incorretas`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_user_id: user.id,
            modo,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar limpeza');
      }

      const data: ResultadoLimpeza = await response.json();
      setResultado(data);

      toast({
        title: modo === 'executar' ? "Correção executada!" : "Relatório gerado",
        description: `${data.resumo.total_alterados} usuários ${modo === 'executar' ? 'corrigidos' : 'com correções pendentes'}`,
        variant: modo === 'executar' ? "default" : "default",
      });
    } catch (error) {
      console.error('Erro ao executar limpeza:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao executar operação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const getAcaoBadge = (acao: string) => {
    if (acao.includes('Removida') || acao.includes('removida')) {
      return <Badge variant="destructive">{acao}</Badge>;
    }
    if (acao.includes('Alterada') || acao.includes('alterada')) {
      return <Badge variant="default" className="bg-amber-500">{acao}</Badge>;
    }
    if (acao.includes('Adicionada') || acao.includes('adicionada')) {
      return <Badge variant="default" className="bg-green-600">{acao}</Badge>;
    }
    return <Badge variant="secondary">{acao}</Badge>;
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Correção de Roles Incorretas
        </CardTitle>
        <CardDescription>
          Detecta e corrige roles atribuídas incorretamente com base no grau e cargo dos integrantes.
          <br />
          <strong>Regras:</strong> Grau V = regional/diretor_regional | Grau VI = divisão | Grau VII+ = sem roles especiais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => executarLimpeza('relatorio')}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Gerar Relatório
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => setConfirmDialogOpen(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar Correção
          </Button>
        </div>

        {resultado && (
          <div className="space-y-4 mt-6">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Analisados</p>
                <p className="text-2xl font-bold">{resultado.resumo.total_analisados}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Alterados</p>
                <p className="text-2xl font-bold text-amber-600">{resultado.resumo.total_alterados}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Roles Removidas</p>
                <p className="text-2xl font-bold text-destructive">{resultado.resumo.roles_removidas}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Roles Adicionadas</p>
                <p className="text-2xl font-bold text-green-600">{resultado.resumo.roles_adicionadas}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Sem Alteração</p>
                <p className="text-2xl font-bold text-muted-foreground">{resultado.resumo.sem_alteracao}</p>
              </Card>
            </div>

            {/* Status do modo */}
            <div className="flex items-center gap-2">
              {resultado.modo === 'executar' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-medium">Correções aplicadas com sucesso</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-600 font-medium">Modo relatório - nenhuma alteração foi feita</span>
                </>
              )}
            </div>

            {/* Tabela de resultados */}
            {resultado.relatorio.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Nome Colete</TableHead>
                        <TableHead>Grau</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Divisão</TableHead>
                        <TableHead>Roles Antes</TableHead>
                        <TableHead>Roles Depois</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.relatorio.map((item, index) => (
                        <TableRow key={item.user_id + index}>
                          <TableCell className="font-medium">{item.nome_colete}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.grau || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {item.cargo_nome || '-'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {item.divisao_texto || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.roles_antes.length > 0 ? (
                                item.roles_antes.map(role => (
                                  <Badge key={role} variant="secondary" className="text-xs">
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.roles_depois.length > 0 ? (
                                item.roles_depois.map(role => (
                                  <Badge key={role} variant="default" className="text-xs">
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getAcaoBadge(item.acao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {resultado.relatorio.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
                <p>Nenhuma correção necessária. Todas as roles estão corretas!</p>
              </div>
            )}
          </div>
        )}

        {/* Dialog de confirmação */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Correção de Roles
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá <strong>modificar as roles de todos os usuários</strong> com atribuições incorretas.
                <br /><br />
                <strong>Esta ação não pode ser desfeita facilmente.</strong>
                <br /><br />
                Recomendamos gerar o relatório primeiro para revisar as alterações.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => executarLimpeza('executar')}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar e Executar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
