import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { ResolverDeltaDialog } from './ResolverDeltaDialog';
import { useResolverDelta } from '@/hooks/useResolverDelta';
import type { Pendencia, DeltaDetalhes } from '@/hooks/usePendencias';

interface DeltasAfastadosProps {
  pendencias: Pendencia[];
  loading: boolean;
  userId?: string;
  isAdmin: boolean;
}

export const DeltasAfastados = ({ pendencias, loading, userId, isAdmin }: DeltasAfastadosProps) => {
  const { resolverDelta } = useResolverDelta();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDelta, setSelectedDelta] = useState<any>(null);

  // Filtrar apenas deltas de afastados
  const deltasAfastados = useMemo(() => {
    return pendencias.filter(
      (p) =>
        p.tipo === 'delta' &&
        ((p.detalhes_completos as DeltaDetalhes).tipo_delta === 'SUMIU_AFASTADOS' ||
          (p.detalhes_completos as DeltaDetalhes).tipo_delta === 'NOVO_AFASTADOS')
    );
  }, [pendencias]);

  // Estatísticas
  const stats = useMemo(() => {
    const sumiu = deltasAfastados.filter(
      (d) => (d.detalhes_completos as DeltaDetalhes).tipo_delta === 'SUMIU_AFASTADOS'
    ).length;
    const novo = deltasAfastados.filter(
      (d) => (d.detalhes_completos as DeltaDetalhes).tipo_delta === 'NOVO_AFASTADOS'
    ).length;

    return { total: deltasAfastados.length, sumiu, novo };
  }, [deltasAfastados]);

  const getTipoDeltaBadge = (tipo: string) => {
    switch (tipo) {
      case 'SUMIU_AFASTADOS':
        return (
          <Badge className="bg-orange-600 hover:bg-orange-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Saiu dos Afastados
          </Badge>
        );
      case 'NOVO_AFASTADOS':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">
            <Clock className="w-3 h-3 mr-1" />
            Novo Afastamento
          </Badge>
        );
      default:
        return <Badge>{tipo}</Badge>;
    }
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
    setSelectedDelta({
      id: detalhes.id, // Agora usando o ID correto do delta
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
      // Forçar reload da página para atualizar os dados
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
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sumiram dos Afastados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <p className="text-3xl font-bold text-orange-600">{stats.sumiu}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novos Afastamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-3xl font-bold text-blue-600">{stats.novo}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Deltas */}
        <Card>
          <CardHeader>
            <CardTitle>Deltas de Afastamentos Pendentes</CardTitle>
            <CardDescription>
              {stats.total === 0
                ? 'Nenhum delta pendente de resolução'
                : `${stats.total} delta(s) aguardando resolução`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deltasAfastados.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <p className="text-xl font-semibold mb-2">Nenhum delta pendente!</p>
                <p className="text-muted-foreground">
                  Todas as alterações nos afastamentos foram revisadas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 text-muted-foreground">Tipo</th>
                      <th className="text-left p-3 text-muted-foreground">Integrante</th>
                      <th className="text-left p-3 text-muted-foreground">Registro</th>
                      <th className="text-left p-3 text-muted-foreground">Divisão</th>
                      <th className="text-left p-3 text-muted-foreground">Cargo/Grau</th>
                      <th className="text-left p-3 text-muted-foreground">Detectado em</th>
                      <th className="text-left p-3 text-muted-foreground">Prioridade</th>
                      {isAdmin && <th className="text-left p-3 text-muted-foreground">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {deltasAfastados.map((pendencia, idx) => {
                      const detalhes = pendencia.detalhes_completos as DeltaDetalhes;
                      return (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-foreground">{getTipoDeltaBadge(detalhes.tipo_delta)}</td>
                          <td className="p-3 font-medium text-foreground">{pendencia.nome_colete}</td>
                          <td className="p-3 text-foreground">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {pendencia.registro_id}
                            </code>
                          </td>
                          <td className="p-3 text-foreground">{pendencia.divisao_texto}</td>
                          <td className="p-3 text-foreground">{detalhes.cargo_grau_texto || '-'}</td>
                          <td className="p-3 text-xs text-foreground">{formatDate(detalhes.created_at)}</td>
                          <td className="p-3 text-foreground">
                            <Badge
                              variant={detalhes.prioridade > 5 ? 'destructive' : 'secondary'}
                            >
                              {detalhes.prioridade}
                            </Badge>
                          </td>
                          {isAdmin && (
                            <td className="p-3 text-foreground">
                              <Button
                                size="sm"
                                onClick={() => handleResolverClick(pendencia)}
                              >
                                Resolver
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Resolução */}
      {selectedDelta && (
        <ResolverDeltaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          delta={selectedDelta}
          onResolve={handleResolve}
        />
      )}
    </>
  );
};
