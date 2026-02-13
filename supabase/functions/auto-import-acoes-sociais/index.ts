import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEFAULT_SPREADSHEET_ID = '1k3GBsA3E8IHTBNByWZz895RLvM0FgyHrgDIKl0szha4';

// Regionais a processar (excluindo CMD)
const REGIONAIS_EXCLUIDAS = ['CMD'];

function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:\?\!\.\,\;\(\)\"\']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegionalText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .trim();
}

const COLUMN_MAPPING: Record<string, string> = {
  'data da acao': 'data_acao',
  'data da acao social': 'data_acao',
  'data_acao': 'data_acao',
  'carimbo de data/hora': 'carimbo',
  'carimbo de datahora': 'carimbo',
  'timestamp': 'carimbo',
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

function parseExcelDate(value: any, carimbo?: string): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return trimmed.substring(0, 10);

    // Formato DD/MM (sem ano) - inferir ano do carimbo ou usar ano atual
    const twoPartMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (twoPartMatch) {
      const [, p1, p2] = twoPartMatch;
      let year = new Date().getFullYear().toString();
      // Tentar extrair ano do carimbo de data/hora (formato DD/MM/YYYY HH:MM:SS)
      if (carimbo) {
        const carimboYearMatch = carimbo.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (carimboYearMatch) {
          year = carimboYearMatch[3];
        }
      }
      // Para DD/MM, assumir formato brasileiro (dia/mês)
      const day = p1.padStart(2, '0');
      const month = p2.padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const [, p1, p2, yearPart] = slashMatch;
      const part1 = parseInt(p1, 10);
      const part2 = parseInt(p2, 10);
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;

      let day: string, month: string;
      if (part1 > 12) {
        day = p1.padStart(2, '0');
        month = p2.padStart(2, '0');
      } else if (part2 > 12) {
        month = p1.padStart(2, '0');
        day = p2.padStart(2, '0');
      } else {
        // Ambíguo - assumir MM/DD/YYYY (padrão Google Forms americano)
        month = p1.padStart(2, '0');
        day = p2.padStart(2, '0');
      }
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

function parseEscopo(value: string): 'interna' | 'externa' {
  const lower = (value || '').toLowerCase();
  if (lower.includes('extern')) return 'externa';
  return 'interna';
}

function gerarHashDeduplicacao(
  dataAcao: string, divisao: string, responsavel: string, tipoAcao: string, escopo: string
): string {
  const texto = [
    dataAcao || '',
    normalizeText(divisao),
    normalizeText(responsavel),
    normalizeText(tipoAcao),
    normalizeText(escopo)
  ].join('|');
  return btoa(texto);
}

function isValidResponsavel(value: string): boolean {
  if (!value || value.trim().length === 0) return false;
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(value.trim())) return false;
  if (/^\d/.test(value.trim())) return false;
  return true;
}

// VP3 mapping for Jacareí
const VP3_REGIONAL = {
  id: '66fb9687-10ac-4f35-830d-8ba5fef92146',
  texto: 'VALE DO PARAIBA III - SP'
};

function getRegionalCorreta(divisaoTexto: string, regionalOriginal: string, regionalIdOriginal: string | null): {
  regional_texto: string;
  regional_id: string | null;
} {
  const divisaoNorm = normalizeText(divisaoTexto);
  if (divisaoNorm.includes('jacarei')) {
    return { regional_texto: VP3_REGIONAL.texto, regional_id: VP3_REGIONAL.id };
  }
  return { regional_texto: regionalOriginal, regional_id: regionalIdOriginal };
}

function isDataAntiga(dataAcao: string, diasLimite: number = 7): boolean {
  const data = new Date(dataAcao);
  const agora = new Date();
  return (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) > diasLimite;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const resultados: { regional: string; inseridos: number; duplicados: number; erros: number }[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[auto-import] ====== Início da importação automática ======');

    // 1. Buscar ID da planilha do banco
    let spreadsheetId = DEFAULT_SPREADSHEET_ID;
    const { data: setting } = await supabase
      .from('system_settings')
      .select('valor_texto')
      .eq('chave', 'google_sheets_acoes_sociais_id')
      .single();
    if (setting?.valor_texto) {
      spreadsheetId = setting.valor_texto;
    }
    console.log(`[auto-import] Planilha: ${spreadsheetId}`);

    // 2. Ler planilha via read-google-sheet
    const sheetResponse = await fetch(`${supabaseUrl}/functions/v1/read-google-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ spreadsheetId, includeHeaders: true }),
    });

    if (!sheetResponse.ok) {
      const errText = await sheetResponse.text();
      throw new Error(`Erro ao ler planilha: ${sheetResponse.status} - ${errText}`);
    }

    const sheetData = await sheetResponse.json();
    if (!sheetData.success || !sheetData.data) {
      throw new Error(`Planilha sem dados: ${sheetData.error || 'desconhecido'}`);
    }

    const allRows: Record<string, string>[] = sheetData.data;
    console.log(`[auto-import] Total de linhas na planilha: ${allRows.length}`);

    // 3. Mapear todas as linhas para formato normalizado
    const registrosMapeados = allRows.map((row) => {
      const resultado: Record<string, string> = {
        data_acao: '', tipo_acao: '', escopo: '', responsavel: '', divisao: '', regional: '', descricao: '', carimbo: ''
      };
      for (const [rawHeader, value] of Object.entries(row)) {
        const normalizedHeader = normalizeHeader(rawHeader);
        const mappedField = COLUMN_MAPPING[normalizedHeader];
        if (mappedField && value) {
          resultado[mappedField] = String(value);
        }
      }
      return {
        ...resultado,
        data_acao_parsed: parseExcelDate(resultado.data_acao, resultado.carimbo),
      };
    });

    // 4. Buscar regionais do banco (exceto CMD)
    const { data: regionais } = await supabase
      .from('regionais')
      .select('id, nome, sigla')
      .order('nome');

    if (!regionais || regionais.length === 0) {
      throw new Error('Nenhuma regional encontrada');
    }

    const regionaisAtivas = regionais.filter(r => !REGIONAIS_EXCLUIDAS.includes(r.sigla || r.nome));
    console.log(`[auto-import] Regionais a processar: ${regionaisAtivas.map(r => r.sigla || r.nome).join(', ')}`);

    // 5. Buscar integrantes para lookup de divisão
    const { data: integrantes } = await supabase
      .from('integrantes_portal')
      .select('nome_colete, nome_colete_ascii, divisao_texto, divisao_id')
      .eq('ativo', true);

    const integrantesMap = new Map<string, { divisao_texto: string; divisao_id: string | null }>();
    (integrantes || []).forEach(i => {
      const nomeNorm = normalizeText(i.nome_colete);
      const nomeAscii = normalizeText(i.nome_colete_ascii || '');
      integrantesMap.set(nomeNorm, { divisao_texto: i.divisao_texto, divisao_id: i.divisao_id });
      if (nomeAscii && nomeAscii !== nomeNorm) {
        integrantesMap.set(nomeAscii, { divisao_texto: i.divisao_texto, divisao_id: i.divisao_id });
      }
    });

    // 6. Buscar hashes existentes
    const { data: existingHashes } = await supabase
      .from('acoes_sociais_registros')
      .select('hash_deduplicacao')
      .not('hash_deduplicacao', 'is', null);

    const hashesExistentes = new Set<string>(
      (existingHashes || []).map(h => {
        try {
          const decoded = atob(h.hash_deduplicacao);
          return btoa(decoded.toLowerCase());
        } catch {
          return (h.hash_deduplicacao || '').toLowerCase();
        }
      }).filter(Boolean)
    );

    console.log(`[auto-import] ${hashesExistentes.size} hashes existentes, ${integrantesMap.size} integrantes`);

    // 7. Buscar um admin profile_id para usar como importador
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const adminProfileId = adminRole?.user_id || '00000000-0000-0000-0000-000000000000';

    // 8. Para cada regional, filtrar e importar
    for (const regional of regionaisAtivas) {
      const normalizedRegionalFilter = normalizeRegionalText(regional.nome);
      console.log(`[auto-import] --- Processando: ${regional.nome} (${regional.sigla}) ---`);

      const acoesDaRegional = registrosMapeados.filter(r => {
        const normalizedRowRegional = normalizeRegionalText(r.regional);
        return normalizedRowRegional.includes(normalizedRegionalFilter) ||
          normalizedRegionalFilter.includes(normalizedRowRegional);
      });

      console.log(`[auto-import] Ações encontradas para ${regional.sigla}: ${acoesDaRegional.length}`);

      if (acoesDaRegional.length === 0) {
        resultados.push({ regional: regional.nome, inseridos: 0, duplicados: 0, erros: 0 });
        continue;
      }

      // Processar registros
      const registrosParaInserir: any[] = [];
      let duplicados = 0;
      let erros = 0;
      const hashesNoLote = new Set<string>();

      for (const registro of acoesDaRegional) {
        const dataAcao = registro.data_acao_parsed;
        const responsavel = (registro.responsavel || '').trim();
        const tipoAcao = (registro.tipo_acao || '').trim();
        const escopoRaw = registro.escopo || '';
        const descricao = (registro.descricao || '').trim();
        const divisaoPlanilha = (registro.divisao || '').trim();

        if (!dataAcao || !isValidResponsavel(responsavel)) {
          if (responsavel) erros++;
          continue;
        }

        // Buscar divisão pelo nome do responsável
        const nomeNormalizado = normalizeText(responsavel);
        let divisaoTexto = divisaoPlanilha;
        let divisaoId: string | null = null;

        if (integrantesMap.has(nomeNormalizado)) {
          const info = integrantesMap.get(nomeNormalizado)!;
          divisaoTexto = info.divisao_texto;
          divisaoId = info.divisao_id;
        } else {
          const matches: { nomeKey: string; divisao_texto: string; divisao_id: string | null }[] = [];
          for (const [nomeKey, divInfo] of integrantesMap) {
            if (nomeKey.startsWith(nomeNormalizado) || nomeNormalizado.startsWith(nomeKey)) {
              matches.push({ nomeKey, ...divInfo });
            }
          }
          if (matches.length > 0) {
            matches.sort((a, b) => a.nomeKey.length - b.nomeKey.length);
            divisaoTexto = matches[0].divisao_texto;
            divisaoId = matches[0].divisao_id;
          }
        }

        const escopoNormalizado = parseEscopo(escopoRaw);
        const hash = gerarHashDeduplicacao(dataAcao, divisaoTexto, responsavel, tipoAcao, escopoNormalizado);

        if (hashesExistentes.has(hash) || hashesNoLote.has(hash)) {
          duplicados++;
          continue;
        }
        hashesNoLote.add(hash);

        // Determinar regional correta (Jacareí → VP3)
        const { regional_texto: regionalCorreta, regional_id: regionalIdCorreta } = getRegionalCorreta(
          divisaoTexto, regional.nome, regional.id
        );

        const foiReportada = isDataAntiga(dataAcao, 7);

        registrosParaInserir.push({
          profile_id: adminProfileId,
          data_acao: dataAcao,
          regional_relatorio_texto: regionalCorreta,
          regional_relatorio_id: regionalIdCorreta,
          divisao_relatorio_texto: divisaoTexto,
          divisao_relatorio_id: divisaoId,
          responsavel_nome_colete: responsavel,
          responsavel_cargo_nome: null,
          responsavel_divisao_texto: divisaoTexto,
          responsavel_regional_texto: regionalCorreta,
          responsavel_comando_texto: 'INSANOS MC',
          escopo_acao: escopoNormalizado,
          tipo_acao_nome_snapshot: tipoAcao,
          descricao_acao: descricao || null,
          status_acao: 'concluida',
          origem_registro: 'importacao_automatica',
          hash_deduplicacao: hash,
          importado_em: new Date().toISOString(),
          importado_por: adminProfileId,
          google_form_status: null,
          foi_reportada_em_relatorio: foiReportada,
        });
      }

      // Inserir em lotes
      let inseridos = 0;
      if (registrosParaInserir.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < registrosParaInserir.length; i += batchSize) {
          const batch = registrosParaInserir.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from('acoes_sociais_registros')
            .insert(batch);

          if (insertError) {
            console.error(`[auto-import] Erro ao inserir lote para ${regional.sigla}:`, insertError.message);
            erros += batch.length;
          } else {
            inseridos += batch.length;
            // Adicionar hashes ao set global para evitar duplicatas entre regionais
            batch.forEach((r: any) => hashesExistentes.add(r.hash_deduplicacao));
          }
        }
      }

      console.log(`[auto-import] ${regional.sigla}: ${inseridos} inseridos, ${duplicados} duplicados, ${erros} erros`);
      resultados.push({ regional: regional.nome, inseridos, duplicados, erros });
    }

    const totalInseridos = resultados.reduce((sum, r) => sum + r.inseridos, 0);
    const totalDuplicados = resultados.reduce((sum, r) => sum + r.duplicados, 0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[auto-import] ====== Concluído em ${elapsed}s: ${totalInseridos} inseridos, ${totalDuplicados} duplicados ======`);

    // Registrar log do sistema
    try {
      await fetch(`${supabaseUrl}/functions/v1/log-system-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          tipo: totalInseridos > 0 ? 'FUNCTION_ERROR' : 'VALIDATION_ERROR',
          origem: 'auto-import-acoes-sociais',
          mensagem: `Importação automática concluída: ${totalInseridos} inseridos, ${totalDuplicados} duplicados (${elapsed}s)`,
          detalhes: { resultados, spreadsheetId, elapsed_seconds: elapsed }
        }),
      });
    } catch (logErr) {
      console.error('[auto-import] Erro ao registrar log:', logErr);
    }

    return new Response(
      JSON.stringify({ success: true, resultados, totalInseridos, totalDuplicados, elapsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[auto-import] Erro geral:', errorMessage);

    // Tentar registrar log de erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${supabaseUrl}/functions/v1/log-system-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          tipo: 'FUNCTION_ERROR',
          origem: 'auto-import-acoes-sociais',
          mensagem: `Erro na importação automática: ${errorMessage}`,
          detalhes: { error: errorMessage }
        }),
      });
    } catch { /* silenciar */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
