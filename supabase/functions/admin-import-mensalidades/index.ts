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

    // 2. Buscar carga anterior ATIVA (antes de desativar)
    console.log('[admin-import-mensalidades] Fetching previous active load...');
    const { data: cargaAnterior, error: fetchError } = await supabase
      .from('mensalidades_atraso')
      .select('id, registro_id, ref, data_carga')
      .eq('ativo', true)
      .order('data_carga', { ascending: false });

    if (fetchError) {
      logError('admin-import-mensalidades', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar registros anteriores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-import-mensalidades] Previous active load: ${cargaAnterior?.length || 0} records`);

    // 3. Detectar liquidações comparando carga anterior com nova
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

    // 4. Desativar carga anterior
    console.log('[admin-import-mensalidades] Deactivating previous load...');
    const { error: deactivateError } = await supabase
      .from('mensalidades_atraso')
      .update({ ativo: false })
      .eq('ativo', true);

    if (deactivateError) {
      console.error('[admin-import-mensalidades] Error deactivating previous load:', deactivateError);
      throw deactivateError;
    }

    // 5. Marcar liquidações
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

    // 6. Inserir novos registros
    console.log(`[admin-import-mensalidades] Inserting ${mensalidades.length} new records...`);
    const dataToInsert = mensalidades.map(m => ({
      registro_id: m.registro_id,
      nome_colete: m.nome_colete,
      divisao_texto: m.divisao_texto,
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

    console.log('[admin-import-mensalidades] ✅ Success');
    console.log(`[admin-import-mensalidades] Inserted: ${mensalidades.length}, Liquidated: ${liquidacoesIds.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        insertedCount: mensalidades.length,
        liquidatedCount: liquidacoesIds.length,
        message: 'Mensalidades importadas com sucesso'
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
