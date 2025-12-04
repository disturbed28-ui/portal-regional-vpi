import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface AcaoExcel {
  data_acao: string;
  regional: string;
  divisao: string;
  responsavel: string;
  escopo: string;
  tipo_acao: string;
  descricao: string;
  email: string;
}

interface ImportResult {
  success: boolean;
  inseridos: number;
  duplicados: number;
  erros: { linha: number; motivo: string }[];
  total_processados: number;
  marcados_como_reportados: number;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Hash sem tipo_acao e descricao para permitir atualizações desses campos
function gerarHashDeduplicacao(registro: {
  data_acao: string;
  divisao: string;
  responsavel: string;
}): string {
  const texto = [
    registro.data_acao,
    normalizeText(registro.divisao),
    normalizeText(registro.responsavel)
  ].join('|');
  
  return btoa(texto);
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  
  // Se for número (serial do Excel)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  // Se for string no formato DD/MM/YY, DD/MM/YYYY, MM/DD/YY ou MM/DD/YYYY
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      let [part1, part2, year] = parts;
      let day: string, month: string;
      
      // Detectar formato automaticamente:
      // Se part1 > 12, é dia (DD/MM/YY - formato brasileiro)
      // Se part1 <= 12 e part2 > 12, é mês (MM/DD/YY - formato americano)
      // Caso ambíguo (ambos <= 12): assumir MM/DD/YY (padrão Excel americano)
      const p1 = parseInt(part1, 10);
      const p2 = parseInt(part2, 10);
      
      if (p1 > 12) {
        // Formato DD/MM/YY (brasileiro)
        day = part1;
        month = part2;
      } else if (p2 > 12) {
        // Formato MM/DD/YY (americano)
        month = part1;
        day = part2;
      } else {
        // Ambíguo - assumir MM/DD/YY (padrão Excel Google Forms americano)
        month = part1;
        day = part2;
      }
      
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Tenta parsear como ISO
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return null;
}

function parseEscopo(value: string): 'interna' | 'externa' {
  const lower = (value || '').toLowerCase();
  if (lower.includes('extern')) return 'externa';
  return 'interna';
}

function isValidResponsavel(value: string): boolean {
  if (!value || value.trim().length === 0) return false;
  
  // Verifica se é uma data (DD/MM/YY ou similar)
  const datePattern = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
  if (datePattern.test(value.trim())) return false;
  
  // Verifica se começa com número (provavelmente data)
  if (/^\d/.test(value.trim())) return false;
  
  return true;
}

// Função para verificar se uma data é mais antiga que X dias
function isDataAntiga(dataAcao: string, diasLimite: number = 7): boolean {
  const data = new Date(dataAcao);
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  return diffDias > diasLimite;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dados_excel, admin_profile_id, regional_id, regional_texto, is_carga_passivo } = await req.json();

    if (!dados_excel || !Array.isArray(dados_excel)) {
      return new Response(
        JSON.stringify({ error: 'Dados do Excel não fornecidos ou inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!admin_profile_id) {
      return new Response(
        JSON.stringify({ error: 'Profile ID do admin não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!regional_texto) {
      return new Response(
        JSON.stringify({ error: 'Regional não selecionada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-acoes-sociais] Iniciando importação de ${dados_excel.length} linhas`);
    console.log(`[import-acoes-sociais] Regional selecionada: ${regional_texto}`);
    console.log(`[import-acoes-sociais] Modo carga de passivo: ${is_carga_passivo ? 'SIM' : 'NÃO'}`);

    // Normalizar texto da regional para comparação flexível
    function normalizeRegionalText(text: string): string {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/vale do paraiba/gi, 'vale do paraiba')
        .replace(/\bi\b/g, '1')
        .replace(/\bii\b/g, '2')
        .replace(/\biii\b/g, '3')
        .trim();
    }

    const regionalFiltro = normalizeRegionalText(regional_texto);
    console.log(`[import-acoes-sociais] Regional normalizada para filtro: ${regionalFiltro}`);

    // Buscar integrantes para lookup de divisão por nome
    const { data: integrantes } = await supabase
      .from('integrantes_portal')
      .select('nome_colete, nome_colete_ascii, divisao_texto, divisao_id')
      .eq('ativo', true);

    const integrantesMap = new Map<string, { divisao_texto: string; divisao_id: string | null }>();
    if (integrantes) {
      integrantes.forEach(i => {
        const nomeNorm = normalizeText(i.nome_colete);
        const nomeAscii = normalizeText(i.nome_colete_ascii || '');
        integrantesMap.set(nomeNorm, { divisao_texto: i.divisao_texto, divisao_id: i.divisao_id });
        if (nomeAscii && nomeAscii !== nomeNorm) {
          integrantesMap.set(nomeAscii, { divisao_texto: i.divisao_texto, divisao_id: i.divisao_id });
        }
      });
    }

    // Buscar hashes existentes para evitar duplicatas
    const { data: existingHashes } = await supabase
      .from('acoes_sociais_registros')
      .select('hash_deduplicacao')
      .not('hash_deduplicacao', 'is', null);

    const hashesExistentes = new Set<string>(
      existingHashes?.map(h => h.hash_deduplicacao) || []
    );

    const result: ImportResult = {
      success: true,
      inseridos: 0,
      duplicados: 0,
      erros: [],
      total_processados: 0,
      marcados_como_reportados: 0
    };

    const registrosParaInserir: any[] = [];
    const hashesNoLote = new Set<string>(); // Para evitar duplicatas dentro do mesmo lote

    for (let i = 0; i < dados_excel.length; i++) {
      const row = dados_excel[i];
      const linhaExcel = i + 2; // +2 porque linha 1 é header
      
      // Filtrar por nome da regional (mais robusto que email)
      const regionalLinha = normalizeRegionalText(row.regional || '');
      if (!regionalLinha.includes(regionalFiltro) && !regionalFiltro.includes(regionalLinha)) {
        continue; // Pular linhas de outras regionais
      }

      result.total_processados++;

      // Validar responsável
      const responsavel = (row.responsavel || '').trim();
      if (!isValidResponsavel(responsavel)) {
        result.erros.push({
          linha: linhaExcel,
          motivo: `Responsável inválido: "${responsavel}" (parece ser uma data ou está vazio)`
        });
        continue;
      }

      // Parsear data
      const dataAcao = parseExcelDate(row.data_acao);
      if (!dataAcao) {
        result.erros.push({
          linha: linhaExcel,
          motivo: `Data da ação inválida: "${row.data_acao}"`
        });
        continue;
      }

      // Buscar divisão pelo nome do responsável
      const nomeNormalizado = normalizeText(responsavel);
      let divisaoTexto = (row.divisao || '').trim();
      let divisaoId: string | null = null;

      // Tentar encontrar integrante por nome parcial
      for (const [nomeKey, divInfo] of integrantesMap) {
        if (nomeKey.includes(nomeNormalizado) || nomeNormalizado.includes(nomeKey)) {
          divisaoTexto = divInfo.divisao_texto;
          divisaoId = divInfo.divisao_id;
          break;
        }
      }

      // Gerar hash de deduplicação (sem tipo_acao e descricao para permitir atualizações)
      const hash = gerarHashDeduplicacao({
        data_acao: dataAcao,
        divisao: divisaoTexto,
        responsavel: responsavel
      });

      // Verificar duplicata no banco de dados existente
      if (hashesExistentes.has(hash)) {
        result.duplicados++;
        continue;
      }

      // Verificar duplicata dentro do mesmo lote
      if (hashesNoLote.has(hash)) {
        result.duplicados++;
        continue;
      }

      // Adicionar hash ao set para evitar duplicatas dentro do mesmo lote
      hashesNoLote.add(hash);

      // Determinar se deve marcar como já reportada
      // Se is_carga_passivo = true E a data é mais antiga que 7 dias -> marcar como reportada
      const foiReportada = is_carga_passivo === true && isDataAntiga(dataAcao, 7);
      
      if (foiReportada) {
        result.marcados_como_reportados++;
      }

      registrosParaInserir.push({
        profile_id: admin_profile_id,
        data_acao: dataAcao,
        regional_relatorio_texto: row.regional || regional_texto,
        regional_relatorio_id: regional_id || null,
        divisao_relatorio_texto: divisaoTexto,
        divisao_relatorio_id: divisaoId,
        responsavel_nome_colete: responsavel,
        responsavel_cargo_nome: null,
        responsavel_divisao_texto: divisaoTexto,
        responsavel_regional_texto: row.regional || regional_texto,
        responsavel_comando_texto: 'INSANOS MC',
        escopo_acao: parseEscopo(row.escopo),
        tipo_acao_nome_snapshot: (row.tipo_acao || '').trim(),
        descricao_acao: (row.descricao || '').trim() || null,
        status_acao: 'concluida',
        origem_registro: 'importacao',
        hash_deduplicacao: hash,
        importado_em: new Date().toISOString(),
        importado_por: admin_profile_id,
        google_form_status: null,
        foi_reportada_em_relatorio: foiReportada
      });
    }

    // Inserir apenas novos registros (sem DELETE para preservar status existentes)
    if (registrosParaInserir.length > 0) {
      console.log(`[import-acoes-sociais] Inserindo ${registrosParaInserir.length} novos registros`);
      
      // Inserir novos registros em lotes
      const batchSize = 100;
      for (let i = 0; i < registrosParaInserir.length; i += batchSize) {
        const batch = registrosParaInserir.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('acoes_sociais_registros')
          .insert(batch);

        if (insertError) {
          console.error('[import-acoes-sociais] Erro ao inserir lote:', insertError);
          result.erros.push({
            linha: 0,
            motivo: `Erro ao inserir registros: ${insertError.message}`
          });
        } else {
          result.inseridos += batch.length;
        }
      }
    }

    console.log(`[import-acoes-sociais] Resultado: ${result.inseridos} inseridos, ${result.duplicados} duplicados, ${result.marcados_como_reportados} marcados como reportados, ${result.erros.length} erros`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-acoes-sociais] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});