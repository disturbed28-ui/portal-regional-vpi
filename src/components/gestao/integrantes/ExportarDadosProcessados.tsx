import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { LoteProcessamento } from "@/hooks/useConsolidacaoIntegrantes";
import { toast } from "@/hooks/use-toast";

interface ExportarDadosProcessadosProps {
  lote: LoteProcessamento;
  dados: any[];
  disabled?: boolean;
  label?: string;
}

export function ExportarDadosProcessados({ lote, dados, disabled = false, label }: ExportarDadosProcessadosProps) {
  const handleExportar = () => {
    try {
      if (dados.length === 0) {
        toast({
          title: "Nada para exportar",
          description: "Selecione pelo menos um registro para exportar",
          variant: "destructive"
        });
        return;
      }

      // Criar workbook
      const wb = XLSX.utils.book_new();
      
      // Adicionar metadata como primeira aba
      const metadata = [
        ['RELATÓRIO DE PROCESSAMENTO - ATUALIZAÇÃO DE INTEGRANTES'],
        [''],
        ['ID do Lote:', lote.id],
        ['Data/Hora:', lote.timestamp.toLocaleString('pt-BR')],
        ['Modo:', lote.modoSimulacao ? 'SIMULAÇÃO' : 'PRODUÇÃO'],
        [''],
        ['Arquivo A:', lote.arquivoA?.nome || '-'],
        ['Registros Arquivo A:', lote.arquivoA?.registros || 0],
        [''],
        ['Arquivo B:', lote.arquivoB?.nome || '-'],
        ['Registros Arquivo B:', lote.arquivoB?.registros || 0],
        [''],
        ['RESUMO:'],
        ['Novos selecionados:', lote.selecao.novos.size],
        ['Atualizados selecionados:', lote.selecao.atualizados.size],
        ['Removidos selecionados:', lote.selecao.removidos.size],
        ['Total a processar:', dados.length]
      ];
      
      const wsMetadata = XLSX.utils.aoa_to_sheet(metadata);
      XLSX.utils.book_append_sheet(wb, wsMetadata, 'Resumo');
      
      // Adicionar dados processados
      const wsDados = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, wsDados, 'Dados Processados');
      
      // Gerar nome do arquivo
      const dataFormatada = lote.timestamp.toISOString().split('T')[0];
      const nomeArquivo = `Processamento_${lote.id}_${dataFormatada}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      toast({
        title: "Exportação concluída",
        description: `Arquivo ${nomeArquivo} gerado com sucesso`
      });
      
    } catch (error) {
      console.error('[ExportarDadosProcessados] Erro:', error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleExportar}
      disabled={disabled || dados.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      {label || `Exportar Dados Processados (${dados.length})`}
    </Button>
  );
}
