import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { useRelatorioData } from '@/hooks/useRelatorioData';
import { useHistoricoCargas } from '@/hooks/useHistoricoCargas';
import { RelatorioTable } from '@/components/relatorios/RelatorioTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardInadimplencia } from '@/components/relatorios/DashboardInadimplencia';
import { EstatisticasEspeciais } from '@/components/relatorios/EstatisticasEspeciais';
import { GraficoEvolucao } from '@/components/relatorios/GraficoEvolucao';
import { TabelaComparativa } from '@/components/relatorios/TabelaComparativa';
import { formatarDataBrasil } from '@/lib/timezone';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

const Relatorios = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { hasRole, loading: rolesLoading } = useUserRole(user?.id);
  
  // Verificar permissões
  const isAutorizado = hasRole('admin') || hasRole('diretor_regional') || hasRole('moderator');

  const { data: relatorioData, isLoading } = useRelatorioData();
  const { data: historicoData, isLoading: isLoadingHistorico } = useHistoricoCargas({
    enabled: !!user?.id && isAutorizado && !rolesLoading
  });

  // Redirecionar para perfil se usuário não tiver nome_colete
  useEffect(() => {
    if (user && !profileLoading && profile && !profile.nome_colete) {
      toast({
        title: "Complete seu cadastro",
        description: "Por favor, adicione seu nome de colete para continuar.",
      });
      navigate("/perfil");
    }
  }, [user, profileLoading, profile, navigate]);

  const handleExportExcel = () => {
    if (!relatorioData) return;

    try {
      const wb = XLSX.utils.book_new();
      const dataAtual = new Date().toLocaleDateString('pt-BR');

      // ===== SHEET 1: Relatório Regional =====
      const sheet1Data: any[][] = [
        ['RELATÓRIO REGIONAL'],
        [`Data: ${dataAtual}`],
        [],
        ['DIVISÕES', 'Entrada', 'Saída', 'Saldo', 'Total Integ. Anterior', 'Total Integ. Atual', 'Devedores'],
      ];

      // Adicionar divisões
      relatorioData.divisoes.forEach((div) => {
        sheet1Data.push([
          div.nome,
          div.entrada,
          div.saida,
          div.saldo,
          div.total_anterior,
          div.total_atual,
          div.devedores,
        ]);
      });

      // Total Regional
      sheet1Data.push([
        'TOTAL REGIONAL',
        relatorioData.totais.entrada,
        relatorioData.totais.saida,
        relatorioData.totais.saldo,
        relatorioData.totais.total_anterior,
        relatorioData.totais.total_atual,
        relatorioData.totais.devedores,
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      XLSX.utils.book_append_sheet(wb, ws1, 'Relatório Regional');

      // ===== SHEET 2: Estatísticas Especiais =====
      const sheet2Data: any[][] = [
        ['ESTATÍSTICAS ESPECIAIS'],
        [],
        ['VEÍCULOS'],
        ['Sem Veículo', relatorioData.totais.sem_veiculo],
        ['Com Moto', relatorioData.totais.com_moto],
        ['Com Carro', relatorioData.totais.com_carro],
      [],
      ['SGT ARMAS'],
      ['Divisão', 'Quantidade'],
    ];

    // Sgt Armas por divisão
    relatorioData.divisoes.forEach((div) => {
      sheet2Data.push([div.nome, div.sgt_armas]);
    });
    sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.sgt_armas]);
    
    sheet2Data.push([]);
    sheet2Data.push(['COMBATE INSANO']);
    sheet2Data.push(['Divisão', 'Quantidade']);
    
    // Combate Insano por divisão
    relatorioData.divisoes.forEach((div) => {
      sheet2Data.push([div.nome, div.combate_insano]);
    });
    sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.combate_insano]);
      
      sheet2Data.push([]);
      sheet2Data.push(['BATEDORES']);
      sheet2Data.push(['Divisão', 'Quantidade']);
      
      // Batedores por divisão
      relatorioData.divisoes.forEach((div) => {
        sheet2Data.push([div.nome, div.batedores]);
      });
      sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.batedores]);
      
      sheet2Data.push([]);
      sheet2Data.push(['CAVEIRAS']);
      sheet2Data.push(['Divisão', 'Titulares', 'Suplentes']);
      
      // Caveiras por divisão
      relatorioData.divisoes.forEach((div) => {
        sheet2Data.push([div.nome, div.caveiras, div.caveiras_suplentes]);
      });
      sheet2Data.push(['TOTAL REGIONAL', relatorioData.totais.caveiras, relatorioData.totais.caveiras_suplentes]);

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'Estatísticas Especiais');

      // Exportar arquivo
      const fileName = `relatorio_regional_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: `Relatório exportado: ${fileName}`,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
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
                Última atualização: {formatarDataBrasil(relatorioData.dataCarga)}
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

        {/* Conteúdo Principal */}
        {relatorioData && (
          <Tabs defaultValue="relatorio" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="relatorio">Relatório</TabsTrigger>
                <TabsTrigger value="evolucao">Evolução Histórica</TabsTrigger>
                <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
              </TabsList>
              
              <TabsContent value="relatorio">
                <div className="space-y-6">
                  <RelatorioTable
                    divisoes={relatorioData.divisoes}
                    totais={relatorioData.totais}
                    regionalNome="REGIONAL VALE DO PARAIBA I"
                  />
                  <EstatisticasEspeciais divisoes={relatorioData.divisoes} totais={relatorioData.totais} />
                </div>
              </TabsContent>
              
              <TabsContent value="evolucao">
                {isLoadingHistorico ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Carregando histórico...</p>
                    </CardContent>
                  </Card>
                ) : historicoData && historicoData.cargas.length >= 2 ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Evolução do Efetivo - Regional Vale do Paraíba I</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GraficoEvolucao 
                          cargas={historicoData.cargas} 
                          divisoesUnicas={historicoData.divisoesUnicas}
                        />
                      </CardContent>
                    </Card>
                    
                    <TabelaComparativa 
                      cargas={historicoData.cargas}
                      divisoesUnicas={historicoData.divisoesUnicas}
                    />
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Dados históricos insuficientes. São necessárias pelo menos 2 cargas para exibir a evolução.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="inadimplencia">
                <DashboardInadimplencia />
              </TabsContent>
            </Tabs>
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
