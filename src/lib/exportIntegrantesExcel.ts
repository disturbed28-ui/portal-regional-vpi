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

interface GrupoIntegrantes {
  id: string;
  nome: string;
  tipo: 'regional' | 'divisao';
  integrantes: IntegranteExport[];
}

/**
 * Exporta lista de integrantes para arquivo Excel com totalizadores
 * @param integrantes - Lista de integrantes a exportar
 * @param filtroNome - Nome do filtro aplicado (para o nome do arquivo)
 * @param grupos - Lista de grupos (opcional) para incluir totalizadores por bloco
 */
export const exportarIntegrantesExcel = (
  integrantes: IntegranteExport[],
  filtroNome: string,
  grupos?: GrupoIntegrantes[]
): void => {
  const dadosExportacao: any[] = [];

  if (grupos && grupos.length > 0) {
    // Exportação com grupos e totalizadores
    grupos.forEach((grupo, index) => {
      // Adicionar integrantes do grupo
      grupo.integrantes.forEach(integrante => {
        dadosExportacao.push({
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
        });
      });

      // Adicionar linha de totalizador do bloco
      dadosExportacao.push({
        'Registro': '',
        'Nome Colete': `TOTAL ${grupo.nome.toUpperCase()}: ${grupo.integrantes.length} ${grupo.integrantes.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}`,
        'Cargo': '',
        'Grau': '',
        'Comando': '',
        'Regional': '',
        'Divisão': '',
        'Ativo': '',
        'Vinculado': '',
        'Data Entrada': '',
        'Data Vinculação': '',
        'Data Inativação': '',
        'Motivo Inativação': '',
        'Sgt. Armas': '',
        'Caveira': '',
        'Caveira Suplente': '',
        'Batedor': '',
        'Lobo': '',
        'Ursinho': '',
        'Combate Insano': '',
        'Tem Carro': '',
        'Tem Moto': '',
        'Observações': ''
      });

      // Adicionar linha vazia entre grupos (exceto após o último)
      if (index < grupos.length - 1) {
        dadosExportacao.push({
          'Registro': '', 'Nome Colete': '', 'Cargo': '', 'Grau': '',
          'Comando': '', 'Regional': '', 'Divisão': '', 'Ativo': '',
          'Vinculado': '', 'Data Entrada': '', 'Data Vinculação': '',
          'Data Inativação': '', 'Motivo Inativação': '', 'Sgt. Armas': '',
          'Caveira': '', 'Caveira Suplente': '', 'Batedor': '', 'Lobo': '',
          'Ursinho': '', 'Combate Insano': '', 'Tem Carro': '', 'Tem Moto': '',
          'Observações': ''
        });
      }
    });

    // Adicionar total geral
    dadosExportacao.push({
      'Registro': '',
      'Nome Colete': '',
      'Cargo': '',
      'Grau': '',
      'Comando': '',
      'Regional': '',
      'Divisão': '',
      'Ativo': '',
      'Vinculado': '',
      'Data Entrada': '',
      'Data Vinculação': '',
      'Data Inativação': '',
      'Motivo Inativação': '',
      'Sgt. Armas': '',
      'Caveira': '',
      'Caveira Suplente': '',
      'Batedor': '',
      'Lobo': '',
      'Ursinho': '',
      'Combate Insano': '',
      'Tem Carro': '',
      'Tem Moto': '',
      'Observações': ''
    });
    dadosExportacao.push({
      'Registro': '',
      'Nome Colete': `TOTAL GERAL: ${integrantes.length} ${integrantes.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}`,
      'Cargo': '',
      'Grau': '',
      'Comando': '',
      'Regional': '',
      'Divisão': '',
      'Ativo': '',
      'Vinculado': '',
      'Data Entrada': '',
      'Data Vinculação': '',
      'Data Inativação': '',
      'Motivo Inativação': '',
      'Sgt. Armas': '',
      'Caveira': '',
      'Caveira Suplente': '',
      'Batedor': '',
      'Lobo': '',
      'Ursinho': '',
      'Combate Insano': '',
      'Tem Carro': '',
      'Tem Moto': '',
      'Observações': ''
    });
  } else {
    // Exportação simples sem grupos
    integrantes.forEach(integrante => {
      dadosExportacao.push({
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
      });
    });
  }

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
