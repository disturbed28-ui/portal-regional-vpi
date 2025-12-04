import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ID padrão da planilha de ações sociais (usado como fallback)
const DEFAULT_SPREADSHEET_ID = "1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo";

interface AcaoSocialPendente {
  data_acao: string;
  tipo_acao: string;
  escopo: string;
  responsavel: string;
  divisao: string;
  regional: string;
  descricao: string;
  hash: string;
}

interface SheetRow {
  [key: string]: string;
}

interface RegistroMapeado {
  data_acao: string | null;
  tipo_acao: string;
  escopo: string;
  responsavel: string;
  divisao: string;
  regional: string;
  descricao: string;
}

export type ConexaoStatus = 'idle' | 'testando' | 'conectado' | 'erro';

// ============================================================================
// MAPEAMENTO FLEXÍVEL DE COLUNAS (igual ao parser do Excel)
// ============================================================================
const COLUMN_MAPPING: Record<string, keyof RegistroMapeado> = {
  // Data da ação (várias variações possíveis)
  'carimbo de data/hora': 'data_acao',
  'carimbo de datahora': 'data_acao',
  'data da acao': 'data_acao',
  'data da acao social': 'data_acao',
  'data': 'data_acao',
  'data_acao': 'data_acao',
  'timestamp': 'data_acao',
  
  // Regional (várias variações)
  'qual a sua regional': 'regional',
  'regional': 'regional',
  'qual regional': 'regional',
  'a qual regional voce pertence': 'regional',
  'sua regional': 'regional',
  'regional_texto': 'regional',
  
  // Divisão (várias variações)
  'divisao': 'divisao',
  'qual a sua divisao': 'divisao',
  'sua divisao': 'divisao',
  'divisao_texto': 'divisao',
  
  // Responsável (várias variações)
  'nome de colete do responsavel pela acao social': 'responsavel',
  'nome de colete do responsavel': 'responsavel',
  'nome do responsavel': 'responsavel',
  'responsavel': 'responsavel',
  'nome de colete': 'responsavel',
  'responsavel_nome_colete': 'responsavel',
  'colete': 'responsavel',
  
  // Tipo de ação (várias variações)
  'tipo de acao social': 'tipo_acao',
  'tipo de acao': 'tipo_acao',
  'tipo': 'tipo_acao',
  'tipo_acao': 'tipo_acao',
  'qual tipo de acao social': 'tipo_acao',
  
  // Escopo (várias variações)
  'escopo da acao social': 'escopo',
  'escopo da acao': 'escopo',
  'escopo': 'escopo',
  'acao interna ou externa': 'escopo',
  'interna ou externa': 'escopo',
  'tipo de escopo': 'escopo',
  
  // Descrição (várias variações)
  'descricao da acao social': 'descricao',
  'descricao da acao': 'descricao',
  'descricao': 'descricao',
  'detalhes': 'descricao',
  'observacoes': 'descricao',
  'obs': 'descricao',
};

// Função para normalizar header (remover acentos, caracteres especiais, lowercase)
const normalizeHeader = (header: string): string => {
  if (!header) return "";
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .toLowerCase()
    .replace(/[:\?\!\.\,\;\(\)\"\']/g, "") // Remove pontuação
    .replace(/\s+/g, " ") // Múltiplos espaços -> um espaço
    .trim();
};

// Função para normalizar texto genérico
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// Função para normalizar texto de regional (mesmo algoritmo do backend)
const normalizeRegionalText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\bi\b/g, "1")
    .trim();
};

// Função para mapear uma row para registro normalizado usando COLUMN_MAPPING
const mapRowToRegistro = (row: SheetRow, debugFirstRow = false): RegistroMapeado => {
  const resultado: RegistroMapeado = {
    data_acao: null,
    tipo_acao: "",
    escopo: "",
    responsavel: "",
    divisao: "",
    regional: "",
    descricao: "",
  };

  const headersEncontrados: string[] = [];
  const headersMapeados: string[] = [];
  const headersNaoMapeados: string[] = [];

  for (const [rawHeader, value] of Object.entries(row)) {
    const normalizedHeader = normalizeHeader(rawHeader);
    headersEncontrados.push(`"${rawHeader}" -> "${normalizedHeader}"`);
    
    const mappedField = COLUMN_MAPPING[normalizedHeader];
    
    if (mappedField && value) {
      headersMapeados.push(`${normalizedHeader} => ${mappedField}`);
      
      // Para data_acao, já vamos parsear depois
      if (mappedField === 'data_acao') {
        resultado.data_acao = value;
      } else {
        resultado[mappedField] = String(value);
      }
    } else if (!mappedField && value) {
      headersNaoMapeados.push(normalizedHeader);
    }
  }

  // Log apenas para a primeira row (debug)
  if (debugFirstRow) {
    console.log("📊 [Google Sheet] Headers encontrados:", headersEncontrados);
    console.log("✅ [Google Sheet] Headers mapeados:", headersMapeados);
    console.log("⚠️ [Google Sheet] Headers não mapeados:", headersNaoMapeados);
  }

  return resultado;
};

// Função para gerar hash de deduplicação (mesmo algoritmo do backend com btoa)
const gerarHashDeduplicacao = (
  dataAcao: string,
  divisao: string,
  responsavel: string
): string => {
  const texto = [
    dataAcao || "",
    normalizeText(divisao),
    normalizeText(responsavel)
  ].join("|");
  
  return btoa(texto);
};

// Função para validar se é um responsável válido (não é data)
const isValidResponsavel = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  const datePattern = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
  if (datePattern.test(value.trim())) return false;
  if (/^\d/.test(value.trim())) return false;
  return true;
};

// Função para parsear data do Excel (com detecção automática de formato)
const parseExcelDate = (value: any): string | null => {
  if (!value) return null;
  
  // Se for número (serial do Excel)
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  // Se for string
  if (typeof value === "string") {
    const trimmed = value.trim();
    
    // Formato YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return trimmed.substring(0, 10);
    }
    
    // Formato com barras (DD/MM/YYYY ou MM/DD/YYYY)
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const [, p1, p2, yearPart] = slashMatch;
      const part1 = parseInt(p1, 10);
      const part2 = parseInt(p2, 10);
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      
      let day: string, month: string;
      
      if (part1 > 12) {
        // Primeiro número > 12, então é DD/MM/YYYY (brasileiro)
        day = p1.padStart(2, "0");
        month = p2.padStart(2, "0");
      } else if (part2 > 12) {
        // Segundo número > 12, então é MM/DD/YYYY (americano)
        month = p1.padStart(2, "0");
        day = p2.padStart(2, "0");
      } else {
        // Ambíguo - assumir DD/MM/YYYY (padrão brasileiro)
        day = p1.padStart(2, "0");
        month = p2.padStart(2, "0");
      }
      
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
};

export const useAcoesSociaisPendentesGoogleSheet = (
  regionalTexto: string,
  enabled: boolean,
  spreadsheetId?: string
) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acoesPendentes, setAcoesPendentes] = useState<AcaoSocialPendente[]>([]);
  const [totalNaPlanilha, setTotalNaPlanilha] = useState(0);
  const [totalJaImportadas, setTotalJaImportadas] = useState(0);
  const [importando, setImportando] = useState(false);
  const [conexaoStatus, setConexaoStatus] = useState<ConexaoStatus>('idle');
  const [conexaoErro, setConexaoErro] = useState<string | null>(null);

  const activeSpreadsheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;

  // Função para testar conexão com a planilha
  const testarConexao = useCallback(async (): Promise<boolean> => {
    if (!activeSpreadsheetId) {
      setConexaoStatus('erro');
      setConexaoErro('ID da planilha não configurado');
      return false;
    }

    setConexaoStatus('testando');
    setConexaoErro(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "read-google-sheet",
        {
          body: {
            spreadsheetId: activeSpreadsheetId,
            range: "A1:A1", // Leitura mínima para testar
            includeHeaders: false,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido ao conectar');
      }

      setConexaoStatus('conectado');
      setConexaoErro(null);
      return true;
    } catch (err: any) {
      console.error("Erro ao testar conexão:", err);
      setConexaoStatus('erro');
      setConexaoErro(err.message || 'Falha na conexão');
      return false;
    }
  }, [activeSpreadsheetId]);

  const buscarAcoesPendentes = useCallback(async () => {
    if (!enabled || !regionalTexto) {
      setAcoesPendentes([]);
      setTotalNaPlanilha(0);
      setTotalJaImportadas(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Buscar dados da planilha
      const { data: sheetResponse, error: sheetError } = await supabase.functions.invoke(
        "read-google-sheet",
        {
          body: {
            spreadsheetId: activeSpreadsheetId,
            includeHeaders: true,
          },
        }
      );

      if (sheetError) {
        throw new Error(`Erro ao ler planilha: ${sheetError.message}`);
      }

      if (!sheetResponse?.success || !sheetResponse?.data) {
        throw new Error("Resposta inválida da planilha");
      }

      // Atualizar status da conexão como sucesso
      setConexaoStatus('conectado');
      setConexaoErro(null);

      const rows: SheetRow[] = sheetResponse.data;
      
      console.log(`📊 [Google Sheet] Total de linhas recebidas: ${rows.length}`);

      // 2. Mapear todas as linhas usando o mapeamento flexível
      const registrosMapeados = rows.map((row, index) => {
        const mapeado = mapRowToRegistro(row, index === 0); // Debug só na primeira linha
        return {
          ...mapeado,
          data_acao_parsed: parseExcelDate(mapeado.data_acao),
        };
      });

      // Log de regionais encontradas para debug
      const regionaisEncontradas = new Set(registrosMapeados.map(r => r.regional).filter(Boolean));
      console.log(`📊 [Google Sheet] Regionais encontradas na planilha:`, Array.from(regionaisEncontradas));
      console.log(`📊 [Google Sheet] Buscando por regional: "${regionalTexto}" (normalizado: "${normalizeRegionalText(regionalTexto)}")`);

      // 3. Filtrar por regional (usando normalização robusta)
      const normalizedRegionalFilter = normalizeRegionalText(regionalTexto);
      const acoesDaRegional = registrosMapeados.filter((registro) => {
        const normalizedRowRegional = normalizeRegionalText(registro.regional);
        const match = normalizedRowRegional.includes(normalizedRegionalFilter) || 
               normalizedRegionalFilter.includes(normalizedRowRegional);
        return match;
      });

      console.log(`📊 [Google Sheet] Ações encontradas para a regional: ${acoesDaRegional.length}`);

      setTotalNaPlanilha(acoesDaRegional.length);

      if (acoesDaRegional.length === 0) {
        setAcoesPendentes([]);
        setTotalJaImportadas(0);
        setLoading(false);
        return;
      }

      // 4. Buscar hashes existentes no banco
      const { data: hashesExistentes, error: hashError } = await supabase
        .from("acoes_sociais_registros")
        .select("hash_deduplicacao")
        .not("hash_deduplicacao", "is", null);

      if (hashError) {
        throw new Error(`Erro ao buscar hashes: ${hashError.message}`);
      }

      const hashSet = new Set(
        (hashesExistentes || []).map((h) => h.hash_deduplicacao)
      );

      // 5. Processar cada registro mapeado e verificar se já foi importada
      const pendentes: AcaoSocialPendente[] = [];
      let jaImportadas = 0;

      for (const registro of acoesDaRegional) {
        const dataAcao = registro.data_acao_parsed;
        const responsavel = registro.responsavel;
        const divisao = registro.divisao;
        const tipoAcao = registro.tipo_acao;
        const escopo = registro.escopo;
        const descricao = registro.descricao;

        // Validar campos obrigatórios (usando mesma lógica do backend)
        if (!dataAcao || !isValidResponsavel(responsavel)) continue;

        const hash = gerarHashDeduplicacao(dataAcao, divisao, responsavel);

        if (hashSet.has(hash)) {
          jaImportadas++;
        } else {
          pendentes.push({
            data_acao: dataAcao,
            tipo_acao: tipoAcao,
            escopo,
            responsavel,
            divisao,
            regional: regionalTexto,
            descricao,
            hash,
          });
        }
      }

      console.log(`📊 [Google Sheet] Resultado: ${pendentes.length} pendentes, ${jaImportadas} já importadas`);

      setTotalJaImportadas(jaImportadas);
      setAcoesPendentes(pendentes);
    } catch (err: any) {
      console.error("Erro ao buscar ações pendentes:", err);
      setError(err.message);
      setConexaoStatus('erro');
      setConexaoErro(err.message);
      toast({
        title: "Erro ao buscar ações",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [enabled, regionalTexto, activeSpreadsheetId, toast]);

  // Buscar quando regional mudar
  useEffect(() => {
    buscarAcoesPendentes();
  }, [buscarAcoesPendentes]);

  // Função para importar todas as ações pendentes
  const importarTodas = async (adminProfileId: string, regionalId?: string) => {
    if (acoesPendentes.length === 0) return;

    setImportando(true);

    try {
      // Converter para o formato esperado pelo endpoint de importação
      const dadosParaImportar = acoesPendentes.map((acao) => ({
        "Carimbo de data/hora": acao.data_acao,
        "Tipo de Ação Social": acao.tipo_acao,
        "Escopo da Ação Social": acao.escopo,
        "Nome de Colete do Responsável pela Ação Social": acao.responsavel,
        "Divisão": acao.divisao,
        "Regional": acao.regional,
        "Descrição da Ação Social": acao.descricao,
      }));

      const { data, error } = await supabase.functions.invoke(
        "import-acoes-sociais",
        {
          body: {
            dados_excel: dadosParaImportar,
            admin_profile_id: adminProfileId,
            regional_id: regionalId,
            regional_texto: regionalTexto,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Importação concluída",
        description: `${data.inseridos} ações importadas com sucesso!`,
      });

      // Recarregar para atualizar lista
      await buscarAcoesPendentes();
    } catch (err: any) {
      console.error("Erro ao importar:", err);
      toast({
        title: "Erro na importação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImportando(false);
    }
  };

  return {
    acoesPendentes,
    totalNaPlanilha,
    totalJaImportadas,
    loading,
    error,
    importarTodas,
    importando,
    refetch: buscarAcoesPendentes,
    conexaoStatus,
    conexaoErro,
    testarConexao,
  };
};
