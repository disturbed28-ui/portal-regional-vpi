import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDatabaseError, logError } from '../_shared/error-handler.ts';

interface MensalidadeImport {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  ref: string;
  valor: number;
  data_vencimento: string;
  situacao: string;
}

interface RequestBody {
  user_id: string;
  mensalidades: MensalidadeImport[];
  realizado_por: string;
}

/**
 * Normaliza texto removendo acentos para matching com tabela divisoes
 * Mantém a estrutura do texto, apenas remove diacríticos
 */
const normalizarTexto = (texto: string): string => {
  if (!texto) return '';
  
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .trim();
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[admin-import-mensalidades] Request received');

    const requestSchema = z.object({
      user_id: z.string().uuid('ID de usuário inválido'),
      mensalidades: z.array(z.object({
        registro_id: z.number().int().positive(),
        nome_colete: z.string().trim().min(1).max(100),
        divisao_texto: z.string().max(100),
        ref: z.string().max(20),
        valor: z.number().positive(),
        data_vencimento: z.string(),
        situacao: z.string().max(50)
      })).min(1, 'Pelo menos uma mensalidade é necessária'),
      realizado_por: z.string().max(100).optional()
    });

    const { user_id, mensalidades, realizado_por } = requestSchema.parse(await req.json());

    console.log(`[admin-import-mensalidades] Validating admin: ${user_id}`);
    console.log(`[admin-import-mensalidades] Mensalidades count: ${mensalidades.length}`);

    // Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validate admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('[admin-import-mensalidades] Unauthorized access attempt:', user_id);
      return new Response(
        JSON.stringify({ error: 'Acesso não autorizado. Apenas admins podem importar mensalidades.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-import-mensalidades] Admin validated successfully');

    // ==========================================
    // MULTI-REGIONAL: Inferir regional de cada registro
    // ==========================================
    
    // 2. Buscar registro_ids únicos para inferir regional
    const registrosIds = [...new Set(mensalidades.map(m => m.registro_id))];
    console.log(`[admin-import-mensalidades] Unique registro_ids: ${registrosIds.length}`);

    // 3. Buscar regional_id de cada integrante (fonte primária)
    const { data: integrantesData } = await supabase
      .from('integrantes_portal')
      .select('registro_id, regional_id, regional_texto, grau')
      .in('registro_id', registrosIds);

    // Criar mapas para lookup rápido
    const integranteRegionalMap = new Map<number, string>();
    const grauVMap = new Map<number, string>();
    
    (integrantesData || []).forEach(i => {
      if (i.regional_id) {
        integranteRegionalMap.set(i.registro_id, i.regional_id);
      }
      if (i.grau === 'V' && i.regional_texto) {
        grauVMap.set(i.registro_id, i.regional_texto);
      }
    });

    console.log(`[admin-import-mensalidades] Integrantes found: ${integrantesData?.length || 0}`);

    // 4. Buscar divisões para fallback de regional (quando integrante não está cadastrado)
    const divisoesTexto = [...new Set(mensalidades.map(m => normalizarTexto(m.divisao_texto)))];
    const { data: divisoesData } = await supabase
      .from('divisoes')
      .select('id, nome, nome_ascii, regional_id');

    // Criar mapa divisao_texto_normalizado -> regional_id
    const divisaoRegionalMap = new Map<string, string>();
    (divisoesData || []).forEach(d => {
      const nomeNormalizado = normalizarTexto(d.nome);
      if (d.regional_id) {
        divisaoRegionalMap.set(nomeNormalizado, d.regional_id);
        if (d.nome_ascii) {
          divisaoRegionalMap.set(d.nome_ascii.toLowerCase(), d.regional_id);
        }
      }
    });

    console.log(`[admin-import-mensalidades] Divisões for fallback: ${divisoesData?.length || 0}`);

    // 5. Identificar regionais únicas na carga
    const regionaisNaCarga = new Set<string>();
    
    mensalidades.forEach(m => {
      // Prioridade 1: regional do integrante cadastrado
      let regionalId = integranteRegionalMap.get(m.registro_id);
      
      // Prioridade 2: fallback pela divisão
      if (!regionalId) {
        const divisaoNormalizada = normalizarTexto(m.divisao_texto);
        regionalId = divisaoRegionalMap.get(divisaoNormalizada);
      }
      
      if (regionalId) {
        regionaisNaCarga.add(regionalId);
      }
    });

    const regionaisArray = Array.from(regionaisNaCarga);
    console.log(`[admin-import-mensalidades] Regionais detected in load: ${regionaisArray.length}`);
    console.log(`[admin-import-mensalidades] Regional IDs: ${regionaisArray.join(', ')}`);

    if (regionaisArray.length === 0) {
      console.error('[admin-import-mensalidades] No regional could be inferred from data');
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar a regional dos dados. Verifique se os integrantes estão cadastrados.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // MULTI-REGIONAL: Buscar carga anterior APENAS das regionais na carga
    // ==========================================
    
    // 6. Buscar carga anterior ATIVA apenas das regionais sendo atualizadas
    console.log('[admin-import-mensalidades] Fetching previous active load for affected regionals...');
    const { data: cargaAnterior, error: fetchError } = await supabase
      .from('mensalidades_atraso')
      .select('id, registro_id, ref, data_carga, regional_id')
      .eq('ativo', true)
      .in('regional_id', regionaisArray)
      .order('data_carga', { ascending: false });

    if (fetchError) {
      logError('admin-import-mensalidades', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar registros anteriores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-import-mensalidades] Previous active load (same regionals): ${cargaAnterior?.length || 0} records`);

    // 7. Detectar liquidações comparando carga anterior com nova (APENAS da mesma regional)
    const cargaAnteriorChaves = new Set(
      (cargaAnterior || []).map(m => `${m.registro_id}_${m.ref}`)
    );
    
    const novasChaves = new Set(
      mensalidades.map(m => `${m.registro_id}_${m.ref}`)
    );

    const liquidacoesChaves = Array.from(cargaAnteriorChaves)
      .filter(chave => !novasChaves.has(chave));

    const liquidacoesIds = (cargaAnterior || [])
      .filter(m => liquidacoesChaves.includes(`${m.registro_id}_${m.ref}`))
      .map(m => m.id);

    console.log(`[admin-import-mensalidades] Liquidations detected: ${liquidacoesIds.length}`);

    // 8. Corrigir divisao_texto para integrantes Grau V e normalizar
    console.log('[admin-import-mensalidades] Validating Grau V members and normalizing...');

    const mensalidadesCorrigidas = mensalidades.map(m => {
      const regionalGrauV = grauVMap.get(m.registro_id);
      
      // Se for Grau V, usar regional_texto como divisao
      let divisaoFinal = regionalGrauV || m.divisao_texto;
      
      // SEMPRE normalizar removendo acentos
      divisaoFinal = normalizarTexto(divisaoFinal);
      
      // Inferir regional_id para cada registro
      let regionalId = integranteRegionalMap.get(m.registro_id);
      if (!regionalId) {
        const divisaoNormalizada = normalizarTexto(m.divisao_texto);
        regionalId = divisaoRegionalMap.get(divisaoNormalizada);
      }
      
      if (regionalGrauV) {
        console.log(`[GRAU V] Corrigindo ${m.nome_colete}: "${m.divisao_texto}" → "${divisaoFinal}"`);
      }
      
      return {
        ...m,
        divisao_texto: divisaoFinal,
        regional_id: regionalId || null
      };
    });

    console.log(`[admin-import-mensalidades] ${grauVMap.size} Grau V members corrected`);

    // ==========================================
    // MULTI-REGIONAL: Desativar APENAS registros das regionais na carga
    // ==========================================
    
    // 9. Desativar carga anterior APENAS das regionais afetadas
    console.log(`[admin-import-mensalidades] Deactivating previous load for regionals: ${regionaisArray.join(', ')}`);
    const { error: deactivateError } = await supabase
      .from('mensalidades_atraso')
      .update({ ativo: false })
      .eq('ativo', true)
      .in('regional_id', regionaisArray);

    if (deactivateError) {
      console.error('[admin-import-mensalidades] Error deactivating previous load:', deactivateError);
      throw deactivateError;
    }

    // 10. Marcar liquidações
    if (liquidacoesIds.length > 0) {
      console.log(`[admin-import-mensalidades] Marking ${liquidacoesIds.length} liquidations...`);
      const { error: liquidacaoError } = await supabase
        .from('mensalidades_atraso')
        .update({ 
          liquidado: true, 
          data_liquidacao: new Date().toISOString() 
        })
        .in('id', liquidacoesIds);

      if (liquidacaoError) {
        console.error('[admin-import-mensalidades] Error marking liquidations:', liquidacaoError);
        throw liquidacaoError;
      }
    }

    // 11. Inserir novos registros COM regional_id
    console.log(`[admin-import-mensalidades] Inserting ${mensalidadesCorrigidas.length} new records...`);
    const dataToInsert = mensalidadesCorrigidas.map(m => ({
      registro_id: m.registro_id,
      nome_colete: m.nome_colete,
      divisao_texto: m.divisao_texto,
      regional_id: m.regional_id, // 🆕 Agora inclui regional_id
      ref: m.ref,
      valor: m.valor,
      data_vencimento: m.data_vencimento,
      situacao: m.situacao,
      ativo: true,
      liquidado: false,
      data_carga: new Date().toISOString(),
      realizado_por: realizado_por || 'Admin'
    }));

    const { error: insertError } = await supabase
      .from('mensalidades_atraso')
      .insert(dataToInsert);

    if (insertError) {
      logError('admin-import-mensalidades', insertError, { count: mensalidades.length });
      return new Response(
        JSON.stringify({ error: handleDatabaseError(insertError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-import-mensalidades] ✅ Success (MULTI-REGIONAL)');
    console.log(`[admin-import-mensalidades] Regionais affected: ${regionaisArray.length}`);
    console.log(`[admin-import-mensalidades] Inserted: ${mensalidadesCorrigidas.length}, Liquidated: ${liquidacoesIds.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        insertedCount: mensalidades.length,
        liquidatedCount: liquidacoesIds.length,
        regionaisCount: regionaisArray.length,
        message: `Mensalidades importadas com sucesso para ${regionaisArray.length} regional(is)`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logError('admin-import-mensalidades', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('admin-import-mensalidades', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
