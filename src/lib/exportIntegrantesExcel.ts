import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface IntegranteExport {
  registro_id: number;
  nome_colete: string;
  cargo_nome: string | null;
  grau: string | null;
  comando_texto: string;
  regional_texto: string;
  divisao_texto: string;
  ativo: boolean | null;
  vinculado: boolean | null;
  data_entrada: string | null;
  data_vinculacao: string | null;
  data_inativacao: string | null;
  motivo_inativacao: string | null;
  sgt_armas: boolean | null;
  caveira: boolean | null;
  caveira_suplente: boolean | null;
  batedor: boolean | null;
  lobo: boolean | null;
  ursinho: boolean | null;
  combate_insano: boolean | null;
  tem_carro: boolean | null;
  tem_moto: boolean | null;
  observacoes: string | null;
}

/**
 * Exporta lista de integrantes para arquivo Excel
 * @param integrantes - Lista de integrantes a exportar
 * @param filtroNome - Nome do filtro aplicado (para o nome do arquivo)
 */
export const exportarIntegrantesExcel = (
  integrantes: IntegranteExport[],
  filtroNome: string
): void => {
  // Preparar dados para exportação
  const dadosExportacao = integrantes.map(integrante => ({
    'Registro': integrante.registro_id,
    'Nome Colete': integrante.nome_colete,
    'Cargo': integrante.cargo_nome || '',
    'Grau': integrante.grau || '',
    'Comando': integrante.comando_texto,
    'Regional': integrante.regional_texto,
    'Divisão': integrante.divisao_texto,
    'Ativo': integrante.ativo ? 'Sim' : 'Não',
    'Vinculado': integrante.vinculado ? 'Sim' : 'Não',
    'Data Entrada': integrante.data_entrada || '',
    'Data Vinculação': integrante.data_vinculacao || '',
    'Data Inativação': integrante.data_inativacao || '',
    'Motivo Inativação': integrante.motivo_inativacao || '',
    'Sgt. Armas': integrante.sgt_armas ? 'Sim' : 'Não',
    'Caveira': integrante.caveira ? 'Sim' : 'Não',
    'Caveira Suplente': integrante.caveira_suplente ? 'Sim' : 'Não',
    'Batedor': integrante.batedor ? 'Sim' : 'Não',
    'Lobo': integrante.lobo ? 'Sim' : 'Não',
    'Ursinho': integrante.ursinho ? 'Sim' : 'Não',
    'Combate Insano': integrante.combate_insano ? 'Sim' : 'Não',
    'Tem Carro': integrante.tem_carro ? 'Sim' : 'Não',
    'Tem Moto': integrante.tem_moto ? 'Sim' : 'Não',
    'Observações': integrante.observacoes || ''
  }));

  // Criar workbook e worksheet
  const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Integrantes');

  // Ajustar largura das colunas
  const columnWidths = [
    { wch: 10 },  // Registro
    { wch: 25 },  // Nome Colete
    { wch: 20 },  // Cargo
    { wch: 8 },   // Grau
    { wch: 15 },  // Comando
    { wch: 20 },  // Regional
    { wch: 20 },  // Divisão
    { wch: 8 },   // Ativo
    { wch: 10 },  // Vinculado
    { wch: 12 },  // Data Entrada
    { wch: 15 },  // Data Vinculação
    { wch: 15 },  // Data Inativação
    { wch: 20 },  // Motivo Inativação
    { wch: 10 },  // Sgt. Armas
    { wch: 8 },   // Caveira
    { wch: 15 },  // Caveira Suplente
    { wch: 8 },   // Batedor
    { wch: 8 },   // Lobo
    { wch: 8 },   // Ursinho
    { wch: 13 },  // Combate Insano
    { wch: 10 },  // Tem Carro
    { wch: 10 },  // Tem Moto
    { wch: 30 }   // Observações
  ];
  worksheet['!cols'] = columnWidths;

  // Gerar nome do arquivo
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  const nomeArquivo = `integrantes_${filtroNome.replace(/\s+/g, '_')}_${dataAtual}.xlsx`;

  // Fazer download
  XLSX.writeFile(workbook, nomeArquivo);
};
