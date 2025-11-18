import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Clock, Info, UserX } from 'lucide-react';
import { ResolverDeltaDialog } from './ResolverDeltaDialog';
import { useResolverDelta } from '@/hooks/useResolverDelta';
import { useTiposDelta } from '@/hooks/useTiposDelta';
import type { Pendencia, DeltaDetalhes } from '@/hooks/usePendencias';

interface DeltasPendentesProps {
  pendencias: Pendencia[];
  loading: boolean;
  userId?: string;
  isAdmin: boolean;
}

export const DeltasPendentes = ({ pendencias, loading, userId, isAdmin }: DeltasPendentesProps) => {
  const { resolverDelta } = useResolverDelta();
  const { getTipoByCode } = useTiposDelta();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDelta, setSelectedDelta] = useState<any>(null);

  // Filtrar todos os deltas pendentes
  const deltasPendentes = useMemo(() => {
    return pendencias.filter(p => p.tipo === 'delta' && p.detalhes_completos != null);
  }, [pendencias]);

  // Estatísticas
  const stats = useMemo(() => {
    const sumiu_ativos = deltasPendentes.filter(
      (d) => (d.detalhes_completos as DeltaDetalhes | null)?.tipo_delta === 'SUMIU_ATIVOS'
    ).length;
    const sumiu_afastados = deltasPendentes.filter(
      (d) => (d.detalhes_completos as DeltaDetalhes | null)?.tipo_delta === 'SUMIU_AFASTADOS'
    ).length;
    const novo_afastados = deltasPendentes.filter(
      (d) => (d.detalhes_completos as DeltaDetalhes | null)?.tipo_delta === 'NOVO_AFASTADOS'
    ).length;

    return { 
      total: deltasPendentes.length, 
      sumiu_ativos,
      sumiu_afastados, 
      novo_afastados 
    };
  }, [deltasPendentes]);

  const getTipoDeltaBadge = (tipo: string) => {
    const tipoDelta = getTipoByCode(tipo);
    if (!tipoDelta) return <Badge>{tipo}</Badge>;
    
    return (
      <Badge style={{ backgroundColor: tipoDelta.cor }}>
        {tipoDelta.icone} {tipoDelta.nome}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResolverClick = (pendencia: Pendencia) => {
    const detalhes = pendencia.detalhes_completos as DeltaDetalhes;
    
    // Validação de segurança
    if (!detalhes) {
      console.error('Detalhes do delta não disponíveis:', pendencia);
      return;
    }
    
    setSelectedDelta({
      id: detalhes.id,
      tipo_delta: detalhes.tipo_delta,
      nome_colete: pendencia.nome_colete,
      registro_id: pendencia.registro_id,
      divisao_texto: pendencia.divisao_texto,
      cargo_grau_texto: detalhes.cargo_grau_texto,
      dados_adicionais: detalhes.dados_adicionais,
      created_at: detalhes.created_at,
    });
    setDialogOpen(true);
  };

  const handleResolve = async (observacao: string, acao: string) => {
    if (!userId || !selectedDelta) return;

    const success = await resolverDelta(selectedDelta.id, observacao, userId);
    
    if (success) {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Carregando deltas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Alert Informativo */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Tipos de Deltas (Anomalias)</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
              <li><strong>Sumiu dos Ativos:</strong> Integrante que estava ativo e desapareceu da carga mais recente</li>
              <li><strong>Sumiu dos Afastados:</strong> Integrante que estava afastado e desapareceu da lista de afastados</li>
              <li><strong>Novo Afastamento:</strong> Integrante que passou para o status de afastado</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Deltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-600" />
                Sumiu dos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.sumiu_ativos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Saiu dos Afastados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.sumiu_afastados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Novos Afastamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.novo_afastados}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Deltas */}
        {deltasPendentes.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                <p className="text-lg font-medium">Nenhum delta pendente</p>
                <p className="text-sm text-muted-foreground">
                  Todas as anomalias foram resolvidas
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Deltas Pendentes ({deltasPendentes.length})</CardTitle>
              <CardDescription>
                Anomalias detectadas que precisam ser revisadas e resolvidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome Colete</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Divisão</TableHead>
                      <TableHead>Cargo/Grau</TableHead>
                      <TableHead>Detectado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deltasPendentes.map((pendencia) => {
                      const detalhes = pendencia.detalhes_completos as DeltaDetalhes;
                      
                      // Validação de segurança - pular se detalhes não existir
                      if (!detalhes) {
                        console.warn('Delta sem detalhes_completos:', pendencia);
                        return null;
                      }
                      
                      return (
                        <TableRow key={detalhes.id}>
                          <TableCell>{getTipoDeltaBadge(detalhes.tipo_delta)}</TableCell>
                          <TableCell className="font-medium">{pendencia.nome_colete}</TableCell>
                          <TableCell>{pendencia.registro_id}</TableCell>
                          <TableCell>{pendencia.divisao_texto}</TableCell>
                          <TableCell>{detalhes.cargo_grau_texto || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(detalhes.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolverClick(pendencia)}
                              >
                                Resolver
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Resolução */}
      <ResolverDeltaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        delta={selectedDelta}
        onResolve={handleResolve}
      />
    </>
  );
};
