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

// Hash sempre normalizado para lowercase - inclui tipo_acao e escopo para diferenciar múltiplas ações do mesmo responsável no mesmo dia
function gerarHashDeduplicacao(registro: {
  data_acao: string;
  divisao: string;
  responsavel: string;
  tipo_acao: string;
  escopo: string;
}): string {
  const texto = [
    registro.data_acao,
    normalizeText(registro.divisao),
    normalizeText(registro.responsavel),
    normalizeText(registro.tipo_acao),
    normalizeText(registro.escopo)
  ].join('|');
  
  return btoa(texto);
}

// Normalizar hash existente para comparação case-insensitive
function normalizeHashParaComparacao(hash: string | null): string {
  if (!hash) return '';
  try {
    // Decodificar, normalizar para lowercase, re-encodar
    const decoded = atob(hash);
    const normalized = decoded.toLowerCase();
    return btoa(normalized);
  } catch {
    // Se falhar decodificação, retornar hash em lowercase
    return hash.toLowerCase();
  }
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

// Mapeamento especial: Divisões de Jacareí pertencem à VP3 (mesmo que planilha diga VP1)
const VP3_REGIONAL = {
  id: '66fb9687-10ac-4f35-830d-8ba5fef92146',
  texto: 'Vale do Paraiba III - SP'
};

function getRegionalCorreta(divisaoTexto: string, regionalOriginal: string, regionalIdOriginal: string | null): { 
  regional_texto: string; 
  regional_id: string | null 
} {
  const divisaoNorm = normalizeText(divisaoTexto);
  
  // Se a divisão for de Jacareí, forçar VP3
  if (divisaoNorm.includes('jacarei')) {
    console.log(`[import-acoes-sociais] Mapeando divisão Jacareí para VP3: ${divisaoTexto}`);
    return {
      regional_texto: VP3_REGIONAL.texto,
      regional_id: VP3_REGIONAL.id
    };
  }
  
  // Caso contrário, manter a regional original
  return {
    regional_texto: regionalOriginal,
    regional_id: regionalIdOriginal
  };
}

// Buscar divisão pelo nome do responsável - PREFERIR NOME MAIS CURTO (mais específico)
function buscarDivisaoPorNome(
  nomeNormalizado: string,
  integrantesMap: Map<string, { divisao_texto: string; divisao_id: string | null }>,
  divisaoDefault: string,
  divisaoIdDefault: string | null
): { divisao_texto: string; divisao_id: string | null } {
  // Busca exata primeiro - prioridade máxima
  if (integrantesMap.has(nomeNormalizado)) {
    return integrantesMap.get(nomeNormalizado)!;
  }

  // Busca parcial - coletar TODOS os matches e escolher o MENOR (mais específico)
  const matches: { nomeKey: string; divisao_texto: string; divisao_id: string | null }[] = [];
  
  for (const [nomeKey, divInfo] of integrantesMap) {
    if (nomeKey.startsWith(nomeNormalizado) || nomeNormalizado.startsWith(nomeKey)) {
      matches.push({ nomeKey, ...divInfo });
    }
  }

  if (matches.length > 0) {
    // Ordenar por tamanho do nome (menor primeiro = mais específico)
    // Ex: "tom a-" (6) vence "tombado" (7)
    matches.sort((a, b) => a.nomeKey.length - b.nomeKey.length);
    return { divisao_texto: matches[0].divisao_texto, divisao_id: matches[0].divisao_id };
  }

  return { divisao_texto: divisaoDefault, divisao_id: divisaoIdDefault };
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

    console.log(`[import-acoes-sociais] ${integrantesMap.size} integrantes carregados para lookup`);

    // Buscar hashes existentes para evitar duplicatas - NORMALIZAR PARA COMPARAÇÃO
    const { data: existingHashes } = await supabase
      .from('acoes_sociais_registros')
      .select('hash_deduplicacao')
      .not('hash_deduplicacao', 'is', null);

    // Normalizar todos os hashes existentes para comparação case-insensitive
    const hashesExistentes = new Set<string>(
      existingHashes?.map(h => normalizeHashParaComparacao(h.hash_deduplicacao)).filter(Boolean) || []
    );

    console.log(`[import-acoes-sociais] ${hashesExistentes.size} hashes existentes carregados (normalizados)`);

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

      // Buscar divisão pelo nome do responsável - PREFERIR NOME MAIS CURTO
      const nomeNormalizado = normalizeText(responsavel);
      const divisaoDefault = (row.divisao || '').trim();
      
      // Remover prefixos comuns: "Social ", "S. " etc.
      let nomeParaBusca = nomeNormalizado;
      if (nomeParaBusca.startsWith('social ')) {
        nomeParaBusca = nomeParaBusca.replace(/^social\s+/, '');
      }
      
      // Tentar com nome original primeiro, depois sem prefixo
      let divisaoTexto = divisaoDefault;
      let divisaoId: string | null = null;
      const nomesParaTentar = [nomeNormalizado];
      if (nomeParaBusca !== nomeNormalizado) {
        nomesParaTentar.push(nomeParaBusca);
      }
      
      for (const nomeTentativa of nomesParaTentar) {
        const resultado = buscarDivisaoPorNome(nomeTentativa, integrantesMap, divisaoDefault, null);
        if (resultado.divisao_id !== null || resultado.divisao_texto !== divisaoDefault) {
          divisaoTexto = resultado.divisao_texto;
          divisaoId = resultado.divisao_id;
          break;
        }
      }
      if (divisaoTexto === divisaoDefault && divisaoId === null) {
        const resultado = buscarDivisaoPorNome(nomeNormalizado, integrantesMap, divisaoDefault, null);
        divisaoTexto = resultado.divisao_texto;
        divisaoId = resultado.divisao_id;
      }

      // Gerar hash de deduplicação (sempre lowercase, com tipo_acao e escopo)
      const tipoAcao = (row.tipo_acao || '').trim();
      const escopoAcao = parseEscopo(row.escopo);
      
      const hash = gerarHashDeduplicacao({
        data_acao: dataAcao,
        divisao: divisaoTexto,
        responsavel: responsavel,
        tipo_acao: tipoAcao,
        escopo: escopoAcao
      });

      // Verificar duplicata no banco de dados existente (comparação normalizada)
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

      // Determinar regional correta (mapeamento Jacareí → VP3)
      const { regional_texto: regionalCorreta, regional_id: regionalIdCorreta } = getRegionalCorreta(
        divisaoTexto,
        row.regional || regional_texto,
        regional_id || null
      );

      registrosParaInserir.push({
        profile_id: admin_profile_id,
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