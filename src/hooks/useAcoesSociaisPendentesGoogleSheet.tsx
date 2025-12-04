import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ID da planilha de ações sociais
const SPREADSHEET_ID = "1Fb1Sby_TmqNjqGmI92RLIxqJsXP3LHPp7tLJbo5olwo";

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

// Função para normalizar texto (remover acentos e lowercase)
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// Função para gerar hash de deduplicação (mesmo algoritmo do backend)
const gerarHashDeduplicacao = (
  dataAcao: string,
  divisao: string,
  responsavel: string
): string => {
  const normalizedData = dataAcao || "";
  const normalizedDivisao = normalizeText(divisao);
  const normalizedResponsavel = normalizeText(responsavel);
  return `${normalizedData}|${normalizedDivisao}|${normalizedResponsavel}`;
};

// Função para parsear data do Excel
const parseExcelDate = (value: any): string | null => {
  if (!value) return null;
  
  // Se for número (serial do Excel)
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  // Se for string
  if (typeof value === "string") {
    // Formato DD/MM/YYYY
    const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    
    // Formato YYYY-MM-DD
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return value.substring(0, 10);
    }
  }
  
  return null;
};

export const useAcoesSociaisPendentesGoogleSheet = (
  regionalTexto: string,
  enabled: boolean
) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acoesPendentes, setAcoesPendentes] = useState<AcaoSocialPendente[]>([]);
  const [totalNaPlanilha, setTotalNaPlanilha] = useState(0);
  const [totalJaImportadas, setTotalJaImportadas] = useState(0);
  const [importando, setImportando] = useState(false);

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
            spreadsheetId: SPREADSHEET_ID,
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

      const rows: SheetRow[] = sheetResponse.data;

      // 2. Filtrar por regional (comparando normalizado)
      const normalizedRegional = normalizeText(regionalTexto);
      const acoesDaRegional = rows.filter((row) => {
        const rowRegional = row["Regional"] || row["regional"] || "";
        return normalizeText(rowRegional) === normalizedRegional;
      });

      setTotalNaPlanilha(acoesDaRegional.length);

      if (acoesDaRegional.length === 0) {
        setAcoesPendentes([]);
        setTotalJaImportadas(0);
        setLoading(false);
        return;
      }

      // 3. Buscar hashes existentes no banco
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

      // 4. Processar cada linha e verificar se já foi importada
      const pendentes: AcaoSocialPendente[] = [];
      let jaImportadas = 0;

      for (const row of acoesDaRegional) {
        const dataAcao = parseExcelDate(
          row["Carimbo de data/hora"] || row["Data da Ação"] || row["data_acao"]
        );
        const responsavel =
          row["Nome de Colete do Responsável pela Ação Social"] ||
          row["Responsável"] ||
          row["responsavel"] ||
          "";
        const divisao =
          row["Divisão"] || row["divisao"] || "";
        const tipoAcao =
          row["Tipo de Ação Social"] ||
          row["Tipo"] ||
          row["tipo_acao"] ||
          "";
        const escopo =
          row["Escopo da Ação Social"] ||
          row["Escopo"] ||
          row["escopo"] ||
          "";
        const descricao =
          row["Descrição da Ação Social"] ||
          row["Descrição"] ||
          row["descricao"] ||
          "";

        if (!dataAcao || !responsavel) continue;

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

      setTotalJaImportadas(jaImportadas);
      setAcoesPendentes(pendentes);
    } catch (err: any) {
      console.error("Erro ao buscar ações pendentes:", err);
      setError(err.message);
      toast({
        title: "Erro ao buscar ações",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [enabled, regionalTexto, toast]);

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
  };
};
