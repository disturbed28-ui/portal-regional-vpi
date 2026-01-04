import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AniversariantePayload {
  nome_colete: string;
  nome_colete_normalizado: string;
  divisao_texto: string;
  divisao_normalizada: string;
  data_nascimento: string;
}

interface RequestBody {
  user_id: string;
  aniversariantes: AniversariantePayload[];
}

interface IntegranteRecord {
  id: string;
  nome_norm: string;
  divisao_norm: string;
  registro_id: number;
}

/**
 * Normaliza texto para comparação (remove acentos, uppercase)
 */
function normalizeForComparison(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca integrante com fallback para matching parcial (divisões truncadas)
 */
function findIntegrante(
  nomeNorm: string,
  divisaoNorm: string,
  integrantesMap: Map<string, { id: string; registro_id: number }>,
  integrantesList: IntegranteRecord[]
): { id: string; registro_id: number } | null {
  
  // 1. Tentar match exato
  const keyExata = `${nomeNorm}|${divisaoNorm}`;
  if (integrantesMap.has(keyExata)) {
    return integrantesMap.get(keyExata)!;
  }
  
  // 2. Tentar match por prefixo - divisão do Excel é início da divisão do banco
  // Ex: "DIVISAO SAO JOSE DOS CAMPOS EXTREMO NORT" matches "DIVISAO SAO JOSE DOS CAMPOS EXTREMO NORTE - SP"
  for (const int of integrantesList) {
    if (int.nome_norm === nomeNorm && int.divisao_norm.startsWith(divisaoNorm)) {
      console.log(`[admin-import-aniversariantes] Match por prefixo: "${divisaoNorm}" -> "${int.divisao_norm}"`);
      return { id: int.id, registro_id: int.registro_id };
    }
  }
  
  // 3. Tentar inverso: divisão do banco é início da divisão do Excel (menos comum)
  for (const int of integrantesList) {
    if (int.nome_norm === nomeNorm && divisaoNorm.startsWith(int.divisao_norm)) {
      console.log(`[admin-import-aniversariantes] Match inverso: "${divisaoNorm}" <- "${int.divisao_norm}"`);
      return { id: int.id, registro_id: int.registro_id };
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { user_id, aniversariantes } = body;

    console.log(`[admin-import-aniversariantes] Iniciando importação para user ${user_id}`);
    console.log(`[admin-import-aniversariantes] Total de registros recebidos: ${aniversariantes.length}`);

    if (!user_id || !aniversariantes || !Array.isArray(aniversariantes)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aniversariantes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          resumo: { atualizados: 0, naoEncontrados: 0, naoEncontradosLista: [] } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os integrantes ativos para fazer matching
    const { data: integrantes, error: intError } = await supabase
      .from('integrantes_portal')
      .select('id, nome_colete, nome_colete_ascii, divisao_texto, registro_id')
      .eq('ativo', true);

    if (intError) {
      console.error('[admin-import-aniversariantes] Erro ao buscar integrantes:', intError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar integrantes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-import-aniversariantes] Total de integrantes ativos no banco: ${integrantes?.length || 0}`);

    // Criar mapa E lista para busca (map para exato, lista para parcial)
    const integrantesMap = new Map<string, { id: string; registro_id: number }>();
    const integrantesList: IntegranteRecord[] = [];
    
    for (const int of integrantes || []) {
      const nomeNorm = normalizeForComparison(int.nome_colete_ascii || int.nome_colete);
      const divisaoNorm = normalizeForComparison(int.divisao_texto);
      
      // Adicionar à lista para busca parcial
      integrantesList.push({
        id: int.id,
        nome_norm: nomeNorm,
        divisao_norm: divisaoNorm,
        registro_id: int.registro_id
      });
      
      // Manter map para match exato (mais rápido)
      const key = `${nomeNorm}|${divisaoNorm}`;
      integrantesMap.set(key, { id: int.id, registro_id: int.registro_id });
    }

    let atualizados = 0;
    const naoEncontradosLista: Array<{ nome_colete: string; divisao: string }> = [];

    // Processar cada aniversariante
    for (const aniv of aniversariantes) {
      const nomeNorm = normalizeForComparison(aniv.nome_colete_normalizado || aniv.nome_colete);
      const divisaoNorm = normalizeForComparison(aniv.divisao_normalizada || aniv.divisao_texto);
      
      // Usar função com fallback para matching parcial
      const integrante = findIntegrante(nomeNorm, divisaoNorm, integrantesMap, integrantesList);
      
      if (integrante) {
        // Atualizar data_nascimento
        const { error: updateError } = await supabase
          .from('integrantes_portal')
          .update({ data_nascimento: aniv.data_nascimento })
          .eq('id', integrante.id);
        
        if (updateError) {
          console.error(`[admin-import-aniversariantes] Erro ao atualizar ${aniv.nome_colete}:`, updateError);
        } else {
          atualizados++;
        }
      } else {
        // Não encontrado
        naoEncontradosLista.push({
          nome_colete: aniv.nome_colete,
          divisao: aniv.divisao_texto
        });
        console.log(`[admin-import-aniversariantes] Não encontrado: ${aniv.nome_colete} | ${aniv.divisao_texto}`);
      }
    }

    console.log(`[admin-import-aniversariantes] Resumo: ${atualizados} atualizados, ${naoEncontradosLista.length} não encontrados`);

    return new Response(
      JSON.stringify({
        success: true,
        resumo: {
          atualizados,
          naoEncontrados: naoEncontradosLista.length,
          naoEncontradosLista: naoEncontradosLista.slice(0, 20) // Limitar lista retornada
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-import-aniversariantes] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
