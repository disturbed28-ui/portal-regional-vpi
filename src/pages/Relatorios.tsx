import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRelatorioData } from '@/hooks/useRelatorioData';
import { RelatorioTable } from '@/components/relatorios/RelatorioTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardInadimplencia } from '@/components/relatorios/DashboardInadimplencia';
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
      const wb = XLSX.utils.book_new();
      const now = new Date();
      
      // Calcular mês e semana
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mesesCompletos = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const mesAbrev = meses[now.getMonth()];
      const mesCompleto = mesesCompletos[now.getMonth()];
      const ano = now.getFullYear().toString().slice(-2);
      const anoCompleto = now.getFullYear();
      
      // Calcular número da semana do mês (aproximado)
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const semanaDoMes = Math.ceil((now.getDate() + firstDay.getDay()) / 7);
      
      const nomeArquivo = `${mesAbrev}.${ano}.Sem.${semanaDoMes}.CMD_V_-_IMC_-_REGIONAL_Vale_do_Paraiba_I.xlsx`;

      // ===== SHEET: Relatório Regional =====
      const wsData: any[][] = [
        // Header
        ['', 'REGIONAL VALE DO PARAIBA I - SP'],
        [],
        ['', ''],
        ['1', '', '', 'Diretor Regional'], // Campos manuais - deixar vazios
        ['1', '', '', 'Operacional Regional'],
        ['1', '', '', 'Social Regional'],
        ['1', '', '', 'ADM Regional'],
        ['1', '', '', 'Comunicação Regional'],
        ['5'],
        [],
        ['', '', '', '', '', `${mesCompleto} / ${anoCompleto}`, '', '', '', 'MÊS Anterior', '', '', now.toLocaleDateString('pt-BR')],
        [],
        // Tabela Principal
        ['', '', '', 'DIVISÕES', '', 'Entrada', 'Saída', '', 'Saldo', '', 'Total Integ. Anterior', '', '', 'Total Integ. Atual', '', 'Cresc. Atual'],
        [],
      ];

      // Adicionar divisões
      relatorioData.divisoes.forEach((div) => {
        const crescimento = div.total_anterior > 0 
          ? ((div.total_atual - div.total_anterior) / div.total_anterior * 100).toFixed(2) + '%'
          : '0.00%';
        
        wsData.push([
          '', '', '', div.nome, '', 
          div.entrada, 
          div.saida, 
          '', 
          div.saldo, 
          '', 
          div.total_anterior, 
          '', '', 
          div.total_atual, 
          '', 
          crescimento
        ]);
      });

      // Totais
      wsData.push(['', '', '', ',', '', '', '', '', '', '', '', '', '', '', '', '']);
      
      const crescimentoTotal = relatorioData.totais.total_anterior > 0
        ? ((relatorioData.totais.total_atual - relatorioData.totais.total_anterior) / relatorioData.totais.total_anterior * 100).toFixed(2) + '%'
        : '0.00%';
      
      wsData.push([
        '', '', '', 'REGIONAL VALE DO PARAIBA I', '', 
        'Entrada', 
        'Saída', 
        '', 
        'Saldo', 
        '', 
        'Geral Integ. Anterior', 
        '', '', 
        'Geral Integ. Atual', 
        '', 
        'Cresc. Atual'
      ]);
      
      wsData.push([
        '', '', '', `${mesCompleto}/${ano}`, '', 
        relatorioData.totais.entrada, 
        relatorioData.totais.saida, 
        '', 
        relatorioData.totais.saldo, 
        '', 
        relatorioData.totais.total_anterior, 
        '', '', 
        relatorioData.totais.total_atual, 
        '', 
        crescimentoTotal
      ]);

      // Efetivo (Veículos)
      wsData.push([]);
      wsData.push([]);
      wsData.push([]);
      wsData.push(['', '', '', 'Efetivo VALE DO PARAIBA I', 'Qtd.', '', 'Perc,']);
      
      const totalEfetivo = relatorioData.totais.total_atual;
      const percSemVeiculo = totalEfetivo > 0 ? ((relatorioData.totais.sem_veiculo / totalEfetivo) * 100).toFixed(2) + '%' : '0.00%';
      const percCarro = totalEfetivo > 0 ? ((relatorioData.totais.com_carro / totalEfetivo) * 100).toFixed(2) + '%' : '0.00%';
      const percMoto = totalEfetivo > 0 ? ((relatorioData.totais.com_moto / totalEfetivo) * 100).toFixed(2) + '%' : '0.00%';
      
      wsData.push(['', '', '', 'Sem Veículo', relatorioData.totais.sem_veiculo, '', percSemVeiculo]);
      wsData.push(['', '', '', 'Carro', relatorioData.totais.com_carro, '', percCarro]);
      wsData.push(['', '', '', 'Moto', relatorioData.totais.com_moto, '', percMoto]);
      wsData.push([]);
      wsData.push(['', '', '', 'Total Efetivo', totalEfetivo]);

      // Inadimplência
      wsData.push([]);
      wsData.push([]);
      wsData.push([]);
      wsData.push([]);
      wsData.push([]);
      wsData.push([]);
      wsData.push(['', '', '', 'Inadimplência']);
      wsData.push([]);
      wsData.push(['', '', '', '', '', 'Divisões', '', '', 'Total', '', 'Perc.', '', 'Pagos']);
      
      relatorioData.divisoes.forEach((div) => {
        const percInadimplencia = div.total_atual > 0 ? ((div.devedores / div.total_atual) * 100).toFixed(2) + '%' : '0.00%';
        const percPagos = div.total_atual > 0 ? (((div.total_atual - div.devedores) / div.total_atual) * 100).toFixed(2) + '%' : '100.00%';
        wsData.push(['', '', '', '', '', div.nome, '', '', div.devedores, '', percInadimplencia, '', percPagos]);
      });
      
      wsData.push([]);
      const percInadimplenciaTotal = totalEfetivo > 0 ? ((relatorioData.totais.devedores / totalEfetivo) * 100).toFixed(2) + '%' : '0.00%';
      const percPagosTotal = totalEfetivo > 0 ? (((totalEfetivo - relatorioData.totais.devedores) / totalEfetivo) * 100).toFixed(2) + '%' : '100.00%';
      wsData.push(['', '', '', '', '', 'Total Geral', '', '', relatorioData.totais.devedores, '', percInadimplenciaTotal, '', percPagosTotal]);

      // Ações (manual)
      wsData.push([]);
      wsData.push(['', '', '', 'Ações.:']);
      wsData.push([]);
      wsData.push([]);
      // Deixar espaço para ações manuais
      for (let i = 0; i < 10; i++) {
        wsData.push(['', '', '', '', '', '', '']);
      }

      // Entrada e Saída
      wsData.push([]);
      wsData.push(['', '', '', 'Entrada e Saída']);
      wsData.push(['', '', '', '', '', 'Entrada', relatorioData.totais.entrada]);
      wsData.push(['', '', '', '', '', 'Saída', relatorioData.totais.saida]);
      wsData.push(['', '', '', '', '', 'Transf. Saída', 0]); // Campo manual
      wsData.push(['', '', '', '', '', 'Saldo', relatorioData.totais.saldo]);

      // Motivos Saída (manual)
      wsData.push([]);
      wsData.push(['', '', '', '', '', 'Motivos Saída:', '', '', '', '', '', '', 'Divisão']);
      wsData.push([]);
      // Deixar espaço para motivos manuais
      for (let i = 0; i < 8; i++) {
        wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
      }

      // Combate Insano
      wsData.push([]);
      wsData.push([]);
      wsData.push(['', '', '', 'Combate Insano']);
      wsData.push(['', '', '', '', '', 'Divisão', '', '', 'Qtd']);
      relatorioData.divisoes.forEach((div) => {
        wsData.push(['', '', '', '', '', div.nome, '', '', div.combate_insano]);
      });
      wsData.push([]);
      wsData.push(['', '', '', '', '', 'Total Regional', '', '', relatorioData.totais.combate_insano]);

      // Batedores
      wsData.push([]);
      wsData.push([]);
      wsData.push(['', '', '', 'Batedores']);
      wsData.push(['', '', '', '', '', 'Divisão', '', '', 'Qtd']);
      relatorioData.divisoes.forEach((div) => {
        wsData.push(['', '', '', '', '', div.nome, '', '', div.batedores]);
      });
      wsData.push([]);
      wsData.push(['', '', '', '', '', 'Total Regional', '', '', relatorioData.totais.batedores]);

      // Time de Caveiras
      wsData.push([]);
      wsData.push([]);
      wsData.push(['', '', '', 'Time de Caveiras']);
      wsData.push(['', '', '', '', '', 'Divisão', '', '', 'Titular', '', 'Suplente']);
      relatorioData.divisoes.forEach((div) => {
        wsData.push(['', '', '', '', '', div.nome, '', '', div.caveiras, '', div.caveiras_suplentes]);
      });
      wsData.push([]);
      wsData.push(['', '', '', '', '', 'Total Regional', '', '', relatorioData.totais.caveiras, '', relatorioData.totais.caveiras_suplentes]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Regional');

      // Exportar
      XLSX.writeFile(wb, nomeArquivo);

      toast({
        title: 'Sucesso',
        description: `Relatório ${nomeArquivo} exportado com sucesso`,
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
            
            <Tabs defaultValue="relatorio" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="relatorio">Relatório</TabsTrigger>
                <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
              </TabsList>
              
              <TabsContent value="relatorio">
                {/* Conteúdo já mostrado acima */}
              </TabsContent>
              
              <TabsContent value="inadimplencia">
                <DashboardInadimplencia />
              </TabsContent>
            </Tabs>
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
