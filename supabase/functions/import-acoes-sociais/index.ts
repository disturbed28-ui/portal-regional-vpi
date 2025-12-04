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
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function gerarHashDeduplicacao(registro: {
  data_acao: string;
  divisao: string;
  responsavel: string;
  tipo_acao: string;
  descricao: string;
}): string {
  const texto = [
    registro.data_acao,
    normalizeText(registro.divisao),
    normalizeText(registro.responsavel),
    normalizeText(registro.tipo_acao),
    normalizeText((registro.descricao || '').substring(0, 50))
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
  
  // Se for string no formato DD/MM/YYYY ou DD/MM/YY
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      let [day, month, year] = parts;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dados_excel, admin_profile_id, regional_id } = await req.json();

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

    console.log(`[import-acoes-sociais] Iniciando importação de ${dados_excel.length} linhas`);

    // Buscar email_base da regional do admin
    const { data: configRegional, error: configError } = await supabase
      .from('acoes_sociais_config_regional')
      .select('email_base, regional_texto')
      .eq('ativo', true)
      .single();

    if (configError || !configRegional?.email_base) {
      console.error('[import-acoes-sociais] Erro ao buscar config regional:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração de e-mail da regional não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailBase = configRegional.email_base.toLowerCase();
    console.log(`[import-acoes-sociais] Email base para filtro: ${emailBase}`);

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
      total_processados: 0
    };

    const registrosParaInserir: any[] = [];

    for (let i = 0; i < dados_excel.length; i++) {
      const row = dados_excel[i];
      const linhaExcel = i + 2; // +2 porque linha 1 é header
      
      // Verificar se o e-mail contém o email_base (filtro tolerante a erros)
      const emailLinha = (row.email || '').toLowerCase();
      if (!emailLinha.includes(emailBase)) {
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

      // Gerar hash de deduplicação
      const hash = gerarHashDeduplicacao({
        data_acao: dataAcao,
        divisao: divisaoTexto,
        responsavel: responsavel,
        tipo_acao: row.tipo_acao || '',
        descricao: row.descricao || ''
      });

      // Verificar duplicata
      if (hashesExistentes.has(hash)) {
        result.duplicados++;
        continue;
      }

      // Adicionar hash ao set para evitar duplicatas dentro do mesmo lote
      hashesExistentes.add(hash);

      registrosParaInserir.push({
        profile_id: admin_profile_id,
        data_acao: dataAcao,
        regional_relatorio_texto: row.regional || configRegional.regional_texto,
        regional_relatorio_id: regional_id || null,
        divisao_relatorio_texto: divisaoTexto,
        divisao_relatorio_id: divisaoId,
        responsavel_nome_colete: responsavel,
        responsavel_cargo_nome: null,
        responsavel_divisao_texto: divisaoTexto,
        responsavel_regional_texto: row.regional || configRegional.regional_texto,
        responsavel_comando_texto: 'INSANOS MC',
        escopo_acao: parseEscopo(row.escopo),
        tipo_acao_nome_snapshot: (row.tipo_acao || '').trim(),
        descricao_acao: (row.descricao || '').trim() || null,
        status_acao: 'concluida',
        origem_registro: 'importacao',
        hash_deduplicacao: hash,
        importado_em: new Date().toISOString(),
        importado_por: admin_profile_id,
        google_form_status: null
      });
    }

    // Inserir em lotes
    if (registrosParaInserir.length > 0) {
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

    console.log(`[import-acoes-sociais] Resultado: ${result.inseridos} inseridos, ${result.duplicados} duplicados, ${result.erros.length} erros`);

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
