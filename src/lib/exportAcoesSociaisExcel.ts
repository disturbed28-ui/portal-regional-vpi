import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface AcaoSocialParaExportar {
  data_acao: string;
  divisao_relatorio_texto: string;
  responsavel_nome_colete: string;
  tipo_acao_nome_snapshot: string;
  escopo_acao: string;
  descricao_acao: string | null;
  status_acao?: string | null;
  created_at?: string | null;
}

export function exportAcoesSociaisToExcel(
  registros: AcaoSocialParaExportar[],
  nomeArquivo?: string
): void {
  // Preparar dados para exportação
  const dadosExportacao = registros.map(r => ({
    'Data da Ação': format(new Date(r.data_acao), 'dd/MM/yyyy'),
    'Divisão': r.divisao_relatorio_texto,
    'Responsável': r.responsavel_nome_colete,
    'Tipo de Ação': r.tipo_acao_nome_snapshot,
    'Escopo': r.escopo_acao === 'externa' ? 'Externa' : 'Interna',
    'Descrição': r.descricao_acao || '',
    'Status': r.status_acao === 'em_andamento' ? 'Em Andamento' : 'Concluída',
    'Data de Registro': r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm') : '',
  }));

  // Criar workbook e worksheet
  const ws = XLSX.utils.json_to_sheet(dadosExportacao);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ações Sociais');

  // Ajustar largura das colunas
  const colWidths = [
    { wch: 12 },  // Data da Ação
    { wch: 25 },  // Divisão
    { wch: 20 },  // Responsável
    { wch: 25 },  // Tipo de Ação
    { wch: 10 },  // Escopo
    { wch: 50 },  // Descrição
    { wch: 15 },  // Status
    { wch: 18 },  // Data de Registro
  ];
  ws['!cols'] = colWidths;

  // Gerar nome do arquivo
  const dataHoje = format(new Date(), 'yyyy-MM-dd');
  const fileName = nomeArquivo || `acoes_sociais_${dataHoje}.xlsx`;

  // Fazer download
  XLSX.writeFile(wb, fileName);
}
