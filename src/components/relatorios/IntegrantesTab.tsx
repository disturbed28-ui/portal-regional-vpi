import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIntegrantesRelatorio } from '@/hooks/useIntegrantesRelatorio';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { IntegranteCard } from './IntegranteCard';
import { IntegranteDetalheModal } from './IntegranteDetalheModal';
import { exportarIntegrantesExcel } from '@/lib/exportIntegrantesExcel';
import { Download, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

export const IntegrantesTab = () => {
  const { user } = useAuth();
  const {
    integrantes,
    integrantesAgrupados,
    opcoesFiltragem,
    filtroAtivo,
    setFiltro,
    loading,
    comboDesabilitado
  } = useIntegrantesRelatorio(user?.id);

  const [integranteSelecionado, setIntegranteSelecionado] = useState<any>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const handleExportarExcel = () => {
    try {
      const opcaoAtual = opcoesFiltragem.find(o => o.value === filtroAtivo);
      const filtroNome = opcaoAtual?.label || 'todos';
      
      exportarIntegrantesExcel(integrantes, filtroNome);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  const handleClickIntegrante = (integrante: any) => {
    setIntegranteSelecionado(integrante);
    setModalAberto(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header com Filtro e Exportar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Select
          value={filtroAtivo || undefined}
          onValueChange={setFiltro}
          disabled={comboDesabilitado}
        >
          <SelectTrigger className="w-full sm:flex-1">
            <SelectValue placeholder="Selecione o filtro" />
          </SelectTrigger>
          <SelectContent>
            {opcoesFiltragem.map(opcao => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="default"
          onClick={handleExportarExcel}
          className="w-full sm:w-auto"
          disabled={integrantes.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Exportar</span>
        </Button>
      </div>

      {/* Listagem */}
      {integrantesAgrupados.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum integrante encontrado com os filtros aplicados
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {integrantesAgrupados.map(grupo => (
            <div key={grupo.id} className="space-y-2">
              {/* Cabeçalho do Grupo */}
              <div className="flex items-center gap-2 px-1">
                {grupo.tipo === 'regional' ? (
                  <div className="flex-1 h-px bg-border" />
                ) : null}
                <h3 className={`text-xs sm:text-sm font-semibold ${
                  grupo.tipo === 'regional' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}>
                  {grupo.tipo === 'regional' ? '═══ ' : '── '}
                  {grupo.nome}
                  {grupo.tipo === 'regional' ? ' ═══' : ' ──'}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Cards dos Integrantes */}
              <div className="space-y-2">
                {grupo.integrantes.map(integrante => (
                  <IntegranteCard
                    key={integrante.id}
                    integrante={integrante}
                    onClick={() => handleClickIntegrante(integrante)}
                  />
                ))}
              </div>

              {/* Total do Bloco */}
              <div className="flex items-center justify-end px-2 py-1">
                <span className="text-xs text-muted-foreground italic">
                  Total {grupo.nome}: {grupo.integrantes.length} {grupo.integrantes.length === 1 ? 'integrante' : 'integrantes'}
                </span>
              </div>
            </div>
          ))}

          {/* Total Geral */}
          <div className="flex items-center justify-center px-2 py-3 mt-4 border-t">
            <span className="text-sm font-semibold text-primary">
              Total Geral: {integrantes.length} {integrantes.length === 1 ? 'integrante' : 'integrantes'}
            </span>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      <IntegranteDetalheModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        integrante={integranteSelecionado}
      />
    </div>
  );
};
