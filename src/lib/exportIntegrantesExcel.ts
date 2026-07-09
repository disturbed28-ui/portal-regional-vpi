import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { formatarNomeComAfastamento } from './afastamentoStatus';

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
  instagram?: string | null;
}

interface GrupoIntegrantes {
  id: string;
  nome: string;
  tipo: 'regional' | 'divisao';
  integrantes: IntegranteExport[];
}

const COLUMN_KEYS = [
  'Registro', 'Nome Colete', 'Cargo', 'Grau', 'Comando', 'Regional', 'Divisão',
  'Ativo', 'Vinculado', 'Data Entrada', 'Data Vinculação', 'Data Inativação',
  'Motivo Inativação', 'Instagram', 'Sgt. Armas', 'Caveira', 'Caveira Suplente',
  'Batedor', 'Lobo', 'Ursinho', 'Combate Insano', 'Tem Carro', 'Tem Moto',
  'Observações'
] as const;

const emptyRow = (overrides: Partial<Record<string, any>> = {}) =>
  COLUMN_KEYS.reduce((acc, key) => {
    acc[key] = overrides[key] ?? '';
    return acc;
  }, {} as Record<string, any>);

const linhaIntegrante = (
  integrante: IntegranteExport,
  afastamentosMap?: Map<number, string>
) => {
  const afastamento = afastamentosMap?.get(integrante.registro_id);
  return {
    'Registro': integrante.registro_id,
    'Nome Colete': formatarNomeComAfastamento(integrante.nome_colete, afastamento),
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
    'Instagram': integrante.instagram || '',
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
  };
};

/**
 * Exporta lista de integrantes para arquivo Excel com totalizadores
 */
export const exportarIntegrantesExcel = (
  integrantes: IntegranteExport[],
  filtroNome: string,
  grupos?: GrupoIntegrantes[],
  afastamentosMap?: Map<number, string>
): void => {
  const dadosExportacao: any[] = [];

  if (grupos && grupos.length > 0) {
    grupos.forEach((grupo, index) => {
      grupo.integrantes.forEach(integrante => {
        dadosExportacao.push(linhaIntegrante(integrante, afastamentosMap));
      });

      dadosExportacao.push(emptyRow({
        'Nome Colete': `TOTAL ${grupo.nome.toUpperCase()}: ${grupo.integrantes.length} ${grupo.integrantes.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}`
      }));

      if (index < grupos.length - 1) {
        dadosExportacao.push(emptyRow());
      }
    });

    dadosExportacao.push(emptyRow());
    dadosExportacao.push(emptyRow({
      'Nome Colete': `TOTAL GERAL: ${integrantes.length} ${integrantes.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}`
    }));
  } else {
    integrantes.forEach(integrante => {
      dadosExportacao.push(linhaIntegrante(integrante, afastamentosMap));
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(dadosExportacao, { header: [...COLUMN_KEYS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Integrantes');

  worksheet['!cols'] = [
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
    { wch: 20 },  // Instagram
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

  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  const nomeArquivo = `integrantes_${filtroNome.replace(/\s+/g, '_')}_${dataAtual}.xlsx`;

  XLSX.writeFile(workbook, nomeArquivo);
};
