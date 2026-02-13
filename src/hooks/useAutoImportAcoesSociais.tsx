import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

// Intervalo de 60 minutos (em ms)
const IMPORT_INTERVAL = 60 * 60 * 1000;

// ID padrão da planilha de ações sociais
const DEFAULT_SPREADSHEET_ID = "1k3GBsA3E8IHTBNByWZz895RLvM0FgyHrgDIKl0szha4";

// Funções de normalização (mesma lógica do hook principal)
const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const normalizeHeader = (header: string): string => {
  if (!header) return "";
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[:\?\!\.\,\;\(\)\"\']/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeRegionalText = (text: string): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\bi\b/g, "1")
    .trim();
};

// Mapeamento de colunas - SEM 'carimbo de data/hora' ou 'timestamp'
const COLUMN_MAPPING: Record<string, string> = {
  'data da acao': 'data_acao',
  'data da acao social': 'data_acao',
  'data_acao': 'data_acao',
  'qual a sua regional': 'regional',
  'regional': 'regional',
  'divisao': 'divisao',
  'qual a sua divisao': 'divisao',
  'nome de colete do responsavel pela acao social': 'responsavel',
  'nome de colete do responsavel': 'responsavel',
  'nome do responsavel': 'responsavel',
  'nome do social responsavel': 'responsavel',
  'social responsavel': 'responsavel',
  'responsavel': 'responsavel',
  'nome de colete': 'responsavel',
  'tipo de acao social': 'tipo_acao',
  'tipo de acao': 'tipo_acao',
  'tipo da acao': 'tipo_acao',
  'tipo': 'tipo_acao',
  'escopo da acao social': 'escopo',
  'escopo da acao': 'escopo',
  'escopo': 'escopo',
  'acao interna ou externa': 'escopo',
  'descricao da acao social': 'descricao',
  'descricao da acao': 'descricao',
  'descricao': 'descricao',
};

const parseExcelDate = (value: any): string | null => {
  if (!value) return null;
  
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return trimmed.substring(0, 10);
    
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const [, p1, p2, yearPart] = slashMatch;
      const part1 = parseInt(p1, 10);
      const part2 = parseInt(p2, 10);
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      
      let day: string, month: string;
      if (part1 > 12) {
        day = p1.padStart(2, "0");
        month = p2.padStart(2, "0");
      } else if (part2 > 12) {
        month = p1.padStart(2, "0");
        day = p2.padStart(2, "0");
      } else {
        // Ambíguo - assumir MM/DD/YYYY (padrão Google Forms americano)
        month = p1.padStart(2, "0");
        day = p2.padStart(2, "0");
      }
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

const parseEscopo = (value: string): 'interna' | 'externa' => {
  const lower = (value || '').toLowerCase();
  if (lower.includes('extern')) return 'externa';
  return 'interna';
};

const gerarHashDeduplicacao = (
  dataAcao: string,
  divisao: string,
  responsavel: string,
  tipoAcao: string,
  escopo: string
): string => {
  const texto = [
    dataAcao || "",
    normalizeText(divisao),
    normalizeText(responsavel),
    normalizeText(tipoAcao),
    normalizeText(escopo)
  ].join("|");
  return btoa(texto);
};

const isValidResponsavel = (value: string): boolean => {
  if (!value || value.trim().length === 0) return false;
  const datePattern = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
  if (datePattern.test(value.trim())) return false;
  if (/^\d/.test(value.trim())) return false;
  return true;
};

interface SheetRow {
  [key: string]: string;
}

export const useAutoImportAcoesSociais = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastImport, setLastImport] = useState<Date | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importingRef = useRef(false);

  const importarAcoesDaRegional = useCallback(async () => {
    // Evitar execuções simultâneas
    if (importingRef.current) {
      console.log('[AutoImport] Já existe uma importação em andamento, pulando...');
      return;
    }

    if (!user?.id || !profile?.regional_id) {
      console.log('[AutoImport] Usuário ou regional não disponível');
      return;
    }

    importingRef.current = true;
    setIsImporting(true);

    try {
      // Buscar ID da planilha do banco de dados (system_settings)
      let spreadsheetId = DEFAULT_SPREADSHEET_ID;
      try {
        const { data: setting } = await supabase
          .from('system_settings')
          .select('valor_texto')
          .eq('chave', 'google_sheets_acoes_sociais_id')
          .single();
        if (setting?.valor_texto) {
          spreadsheetId = setting.valor_texto;
          console.log(`[AutoImport] Usando ID da planilha do banco: ${spreadsheetId}`);
        }
      } catch {
        console.log('[AutoImport] Usando ID padrão da planilha');
      }

      // Buscar nome da regional
      const { data: regional } = await supabase
        .from('regionais')
        .select('nome')
        .eq('id', profile.regional_id)
        .single();

      if (!regional?.nome) {
        console.log('[AutoImport] Regional não encontrada');
        return;
      }

      const regionalTexto = regional.nome;
      console.log(`[AutoImport] Iniciando importação para regional: ${regionalTexto}`);

      // Ler planilha do Google
      const { data: sheetResponse, error: sheetError } = await supabase.functions.invoke(
        "read-google-sheet",
        {
          body: {
            spreadsheetId,
            includeHeaders: true,
          },
        }
      );

      if (sheetError || !sheetResponse?.success) {
        console.error('[AutoImport] Erro ao ler planilha:', sheetError?.message || sheetResponse?.error);
        return;
      }

      const rows: SheetRow[] = sheetResponse.data || [];
      console.log(`[AutoImport] Linhas recebidas da planilha: ${rows.length}`);

      // Mapear linhas
      interface RegistroMapeado {
        data_acao: string | null;
        tipo_acao: string;
        escopo: string;
        responsavel: string;
        divisao: string;
        regional: string;
        descricao: string;
        data_acao_parsed: string | null;
      }

      const registrosMapeados: RegistroMapeado[] = rows.map((row) => {
        const resultado = {
          data_acao: null as string | null,
          tipo_acao: "",
          escopo: "",
          responsavel: "",
          divisao: "",
          regional: "",
          descricao: "",
        };

        for (const [rawHeader, value] of Object.entries(row)) {
          const normalizedHeader = normalizeHeader(rawHeader);
          const mappedField = COLUMN_MAPPING[normalizedHeader];
          if (mappedField && value) {
            (resultado as any)[mappedField] = String(value);
          }
        }

        return {
          ...resultado,
          data_acao_parsed: parseExcelDate(resultado.data_acao),
        };
      });

      // Filtrar por regional
      const normalizedRegionalFilter = normalizeRegionalText(regionalTexto);
      const acoesDaRegional = registrosMapeados.filter((registro) => {
        const normalizedRowRegional = normalizeRegionalText(registro.regional);
        return normalizedRowRegional.includes(normalizedRegionalFilter) || 
               normalizedRegionalFilter.includes(normalizedRowRegional);
      });

      console.log(`[AutoImport] Ações da regional ${regionalTexto}: ${acoesDaRegional.length}`);

      if (acoesDaRegional.length === 0) {
        setLastImport(new Date());
        return;
      }

      // Buscar hashes existentes
      const { data: hashesExistentes } = await supabase
        .from("acoes_sociais_registros")
        .select("hash_deduplicacao")
        .not("hash_deduplicacao", "is", null);

      const hashSet = new Set((hashesExistentes || []).map((h) => h.hash_deduplicacao));

      // Buscar integrantes para lookup de divisão
      const { data: integrantes } = await supabase
        .from("integrantes_portal")
        .select("nome_colete, nome_colete_ascii, divisao_texto")
        .eq("ativo", true);

      const integrantesMap = new Map<string, string>();
      (integrantes || []).forEach((i) => {
        const nomeNorm = normalizeText(i.nome_colete);
        const nomeAscii = normalizeText(i.nome_colete_ascii || "");
        if (nomeNorm) integrantesMap.set(nomeNorm, i.divisao_texto);
        if (nomeAscii && nomeAscii !== nomeNorm) integrantesMap.set(nomeAscii, i.divisao_texto);
      });

      // Processar e filtrar pendentes
      const pendentes: any[] = [];

      for (const registro of acoesDaRegional) {
        const dataAcao = registro.data_acao_parsed;
        const responsavel = registro.responsavel || "";
        const divisaoPlanilha = registro.divisao || "";
        const tipoAcao = registro.tipo_acao || "";
        const escopo = registro.escopo || "";
        const descricao = registro.descricao || "";

        if (!dataAcao || !isValidResponsavel(responsavel)) continue;

        // Buscar divisão pelo nome do responsável
        const nomeNormalizado = normalizeText(responsavel);
        let divisaoParaHash = divisaoPlanilha;

        if (integrantesMap.has(nomeNormalizado)) {
          divisaoParaHash = integrantesMap.get(nomeNormalizado)!;
        } else {
          const matches: { nomeKey: string; divisaoTexto: string }[] = [];
          for (const [nomeKey, divisaoTexto] of integrantesMap) {
            if (nomeKey.startsWith(nomeNormalizado) || nomeNormalizado.startsWith(nomeKey)) {
              matches.push({ nomeKey, divisaoTexto });
            }
          }
          if (matches.length > 0) {
            matches.sort((a, b) => a.nomeKey.length - b.nomeKey.length);
            divisaoParaHash = matches[0].divisaoTexto;
          }
        }

        const escopoNormalizado = parseEscopo(escopo);
        const hash = gerarHashDeduplicacao(dataAcao, divisaoParaHash, responsavel, tipoAcao, escopoNormalizado);

        if (!hashSet.has(hash)) {
          pendentes.push({
            data_acao: dataAcao,
            tipo_acao: tipoAcao,
            escopo: escopoNormalizado,
            responsavel,
            divisao: divisaoParaHash,
            regional: regionalTexto,
            descricao,
            hash,
          });
        }
      }

      console.log(`[AutoImport] Ações pendentes para importar: ${pendentes.length}`);

      // Se há pendentes, importar via edge function
      if (pendentes.length > 0) {
        const { data: importResult, error: importError } = await supabase.functions.invoke(
          'import-acoes-sociais',
          {
            body: {
              acoes: pendentes.map(p => ({
                data_acao: p.data_acao,
                tipo_acao_nome: p.tipo_acao,
                escopo_acao: p.escopo,
                responsavel_nome_colete: p.responsavel,
                divisao_texto: p.divisao,
                regional_texto: p.regional,
                descricao_acao: p.descricao,
                hash_deduplicacao: p.hash,
              })),
              profile_id: user.id,
              regional_texto: regionalTexto,
            },
          }
        );

        if (importError) {
          console.error('[AutoImport] Erro ao importar:', importError.message);
        } else {
          console.log(`[AutoImport] Resultado da importação:`, importResult);
        }
      }

      setLastImport(new Date());
      console.log(`[AutoImport] Importação concluída para ${regionalTexto}`);

    } catch (err) {
      console.error('[AutoImport] Erro durante importação:', err);
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  }, [user?.id, profile?.regional_id]);

  useEffect(() => {
    if (!user?.id || !profile?.regional_id) return;

    console.log('[AutoImport] Configurando importação automática...');

    // Executar após 5 segundos (dar tempo para carregar tudo)
    const initialTimeout = setTimeout(() => {
      importarAcoesDaRegional();
    }, 5000);

    // Configurar intervalo de 60 minutos
    intervalRef.current = setInterval(() => {
      console.log('[AutoImport] Executando importação agendada (60 min)');
      importarAcoesDaRegional();
    }, IMPORT_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user?.id, profile?.regional_id, importarAcoesDaRegional]);

  return { lastImport, isImporting };
};
