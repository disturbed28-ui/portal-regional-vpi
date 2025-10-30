import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRelatorioData } from '@/hooks/useRelatorioData';
import { RelatorioTable } from '@/components/relatorios/RelatorioTable';
import { EstatisticasEspeciais } from '@/components/relatorios/EstatisticasEspeciais';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

const Relatorios = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasRole } = useUserRole(user?.uid);
  
  // Verificar permissões
  const isAutorizado = hasRole('admin') || hasRole('diretor_regional');

  const { data: relatorioData, isLoading } = useRelatorioData();

  const handleExportExcel = () => {
    if (!relatorioData) return;

    try {
      // Criar workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Relatório Principal
      const wsData: any[][] = [
        ['RELATÓRIO REGIONAL'],
        ['Data:', relatorioData.dataCarga ? new Date(relatorioData.dataCarga).toLocaleDateString('pt-BR') : 'N/A'],
        [],
        ['DIVISÕES', 'Entrada', 'Saída', 'Saldo', 'Total Integ. Anterior', 'Total Integ. Atual', 'Devedores'],
      ];

      relatorioData.divisoes.forEach((div) => {
        wsData.push([
          div.nome,
          div.entrada,
          div.saida,
          div.saldo,
          div.total_anterior,
          div.total_atual,
          div.devedores,
        ]);
      });

      wsData.push([
        'TOTAL REGIONAL',
        relatorioData.totais.entrada,
        relatorioData.totais.saida,
        relatorioData.totais.saldo,
        relatorioData.totais.total_anterior,
        relatorioData.totais.total_atual,
        relatorioData.totais.devedores,
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Principal');

      // Sheet 2: Estatísticas Especiais
      const wsStats: any[][] = [
        ['ESTATÍSTICAS ESPECIAIS'],
        [],
        ['VEÍCULOS'],
        ['Sem Veículo', relatorioData.totais.sem_veiculo],
        ['Com Moto', relatorioData.totais.com_moto],
        ['Com Carro', relatorioData.totais.com_carro],
        [],
        ['COMBATE INSANO (SGT ARMAS)'],
        ['Divisão', 'Quantidade'],
      ];

      relatorioData.divisoes.forEach((div) => {
        wsStats.push([div.nome, div.combate_insano]);
      });
      wsStats.push(['TOTAL REGIONAL', relatorioData.totais.combate_insano]);

      wsStats.push([]);
      wsStats.push(['BATEDORES']);
      wsStats.push(['Divisão', 'Quantidade']);
      relatorioData.divisoes.forEach((div) => {
        wsStats.push([div.nome, div.batedores]);
      });
      wsStats.push(['TOTAL REGIONAL', relatorioData.totais.batedores]);

      wsStats.push([]);
      wsStats.push(['TIME DE CAVEIRAS']);
      wsStats.push(['Divisão', 'Titulares', 'Suplentes']);
      relatorioData.divisoes.forEach((div) => {
        wsStats.push([div.nome, div.caveiras, div.caveiras_suplentes]);
      });
      wsStats.push(['TOTAL REGIONAL', relatorioData.totais.caveiras, relatorioData.totais.caveiras_suplentes]);

      const wsStatistics = XLSX.utils.aoa_to_sheet(wsStats);
      XLSX.utils.book_append_sheet(wb, wsStatistics, 'Estatísticas');

      // Exportar
      XLSX.writeFile(wb, `relatorio_regional_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar relatório',
        variant: 'destructive',
      });
    }
  };

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Você não tem permissão para acessar esta página.</p>
            <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <p className="text-lg">Carregando relatório...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Relatório Regional</h1>
            {relatorioData?.dataCarga && (
              <p className="text-sm text-muted-foreground">
                Última atualização: {new Date(relatorioData.dataCarga).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Tabela Principal */}
        {relatorioData && (
          <>
            <RelatorioTable
              divisoes={relatorioData.divisoes}
              totais={relatorioData.totais}
              regionalNome="REGIONAL VALE DO PARAIBA I"
            />

            {/* Estatísticas Especiais */}
            <EstatisticasEspeciais divisoes={relatorioData.divisoes} totais={relatorioData.totais} />
          </>
        )}

        {!relatorioData?.divisoes.length && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum dado disponível. Faça o upload de integrantes para gerar o relatório.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Relatorios;
