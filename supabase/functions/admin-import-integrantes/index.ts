import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CampoAlterado {
  campo: string;
  anterior: string;
  novo: string;
}

function compararCampos(antigo: any, novo: any): CampoAlterado[] {
  const mudancas: CampoAlterado[] = [];
  
  const camposComparar = [
    'nome_colete', 'comando_texto', 'regional_texto', 'divisao_texto',
    'cargo_nome', 'cargo_grau_texto', 'grau', 'cargo_estagio',
    'ativo', 'vinculado', 'lobo', 'caveira', 'caveira_suplente',
    'ursinho', 'combate_insano', 'batedor', 'sgt_armas',
    'tem_moto', 'tem_carro', 'data_entrada', 'observacoes'
  ];

  for (const campo of camposComparar) {
    const valorAntigo = antigo[campo];
    const valorNovo = novo[campo];
    
    if (valorAntigo !== valorNovo) {
      mudancas.push({
        campo,
        anterior: String(valorAntigo ?? ''),
        novo: String(valorNovo ?? '')
      });
    }
  }

  return mudancas;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[admin-import-integrantes] Request received');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { admin_user_id, novos, atualizados } = await req.json();

    console.log('[admin-import-integrantes] Validating admin:', admin_user_id);
    console.log('[admin-import-integrantes] Novos:', novos?.length || 0);
    console.log('[admin-import-integrantes] Atualizados:', atualizados?.length || 0);

    // Validate required parameters
    if (!admin_user_id) {
      return new Response(
        JSON.stringify({ error: 'admin_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', admin_user_id);

    if (roleError) {
      console.error('[admin-import-integrantes] Error checking roles:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error checking admin role', details: roleError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdminRole = roles?.some((r: any) => r.role === 'admin');
    
    if (!hasAdminRole) {
      console.warn('[admin-import-integrantes] User does not have admin role:', admin_user_id);
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilegios de admin necessarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-import-integrantes] Admin validated successfully');

    let insertedCount = 0;
    let updatedCount = 0;

    // Upsert new integrantes (insert or update if registro_id exists)
    if (novos && novos.length > 0) {
      // Filter out any records with null/undefined registro_id
      const validNovos = novos.filter((item: any) => item.registro_id != null);
      
      console.log('[admin-import-integrantes] Total novos received:', novos.length);
      console.log('[admin-import-integrantes] Valid novos (non-null registro_id):', validNovos.length);
      
      // Deduplicate by registro_id (keep last occurrence)
      const seenIds = new Set();
      const uniqueNovos = [];
      const duplicates = [];
      
      for (const item of validNovos) {
        if (seenIds.has(item.registro_id)) {
          duplicates.push(item.registro_id);
        } else {
          seenIds.add(item.registro_id);
          uniqueNovos.push(item);
        }
      }
      
      if (duplicates.length > 0) {
        console.log('[admin-import-integrantes] Duplicate registro_ids found:', duplicates);
      }
      
      console.log('[admin-import-integrantes] Unique novos after dedup:', uniqueNovos.length);
      
      const { error: upsertError } = await supabase
        .from('integrantes_portal')
        .upsert(uniqueNovos, { 
          onConflict: 'registro_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('[admin-import-integrantes] Error upserting:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao processar integrantes', details: upsertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedCount = uniqueNovos.length;
    }

    // Update existing integrantes and save old data for comparison
    const dadosAntigos = new Map();
    
    if (atualizados && atualizados.length > 0) {
      console.log('[admin-import-integrantes] Updating atualizados:', atualizados.length);
      
      for (const update of atualizados) {
        const { id, ...updateData } = update;
        
        // Fetch old data before updating
        const { data: oldData } = await supabase
          .from('integrantes_portal')
          .select('*')
          .eq('id', id)
          .single();
        
        if (oldData) {
          dadosAntigos.set(id, oldData);
        }
        
        const { error: updateError } = await supabase
          .from('integrantes_portal')
          .update(updateData)
          .eq('id', id);

        if (updateError) {
          console.error('[admin-import-integrantes] Error updating:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar integrante', details: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        updatedCount++;
      }
    }

    console.log('[admin-import-integrantes] Success - Inserted:', insertedCount, 'Updated:', updatedCount);

    // Fetch all active integrantes to create snapshot
    const { data: integrantesAtivos, error: fetchError } = await supabase
      .from('integrantes_portal')
      .select('*')
      .eq('ativo', true);

    if (fetchError) {
      console.error('[admin-import-integrantes] Error fetching integrantes:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar integrantes', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate snapshot aggregated by division
    const divisoesMap = new Map<string, any>();
    
    for (const integrante of integrantesAtivos || []) {
      const divisaoKey = integrante.divisao_texto;
      
      if (!divisoesMap.has(divisaoKey)) {
        divisoesMap.set(divisaoKey, {
          divisao: divisaoKey,
          regional: integrante.regional_texto,
          comando: integrante.comando_texto,
          total: 0,
          vinculados: 0,
          nao_vinculados: 0
        });
      }
      
      const divisaoStats = divisoesMap.get(divisaoKey);
      divisaoStats.total++;
      
      if (integrante.vinculado) {
        divisaoStats.vinculados++;
      } else {
        divisaoStats.nao_vinculados++;
      }
    }

    const snapshot = {
      divisoes: Array.from(divisoesMap.values()),
      periodo: new Date().toISOString()
    };

    // Insert into cargas_historico
    const { data: cargaData, error: cargaError } = await supabase
      .from('cargas_historico')
      .insert({
        data_carga: new Date().toISOString(),
        total_integrantes: integrantesAtivos?.length || 0,
        dados_snapshot: snapshot,
        realizado_por: admin_user_id,
        observacoes: `Importação: ${insertedCount} novos, ${updatedCount} atualizados`
      })
      .select('id, data_carga')
      .single();

    if (cargaError) {
      console.error('[admin-import-integrantes] Error inserting carga:', cargaError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar histórico', details: cargaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-import-integrantes] Carga saved:', cargaData?.id);

    // Save detailed updates to atualizacoes_carga
    if (atualizados && atualizados.length > 0) {
      const atualizacoesDetalhadas = [];

      for (const atualizado of atualizados) {
        const antigoIntegrante = dadosAntigos.get(atualizado.id);

        if (antigoIntegrante) {
          const mudancas = compararCampos(antigoIntegrante, atualizado);
          
          for (const mudanca of mudancas) {
            atualizacoesDetalhadas.push({
              carga_historico_id: cargaData.id,
              integrante_id: atualizado.id,
              registro_id: atualizado.registro_id || antigoIntegrante.registro_id,
              nome_colete: atualizado.nome_colete || antigoIntegrante.nome_colete,
              campo_alterado: mudanca.campo,
              valor_anterior: mudanca.anterior,
              valor_novo: mudanca.novo
            });
          }
        }
      }

      if (atualizacoesDetalhadas.length > 0) {
        const { error: atualizacoesError } = await supabase
          .from('atualizacoes_carga')
          .insert(atualizacoesDetalhadas);

        if (atualizacoesError) {
          console.error('[admin-import-integrantes] Error saving atualizacoes:', atualizacoesError);
        } else {
          console.log('[admin-import-integrantes] Saved', atualizacoesDetalhadas.length, 'detailed updates');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        insertedCount, 
        updatedCount,
        message: `${insertedCount} novos, ${updatedCount} atualizados`,
        carga: {
          id: cargaData.id,
          data_carga: cargaData.data_carga,
          total_atualizados: updatedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-import-integrantes] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
