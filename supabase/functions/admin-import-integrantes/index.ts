import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleDatabaseError, logError } from '../_shared/error-handler.ts'

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

    const requestSchema = z.object({
      admin_user_id: z.string().uuid('ID de admin inválido'),
      novos: z.array(z.object({
        registro_id: z.number().int().positive(),
        nome_colete: z.string().trim().min(1).max(100),
        comando_texto: z.string().max(100),
        regional_texto: z.string().max(100),
        divisao_texto: z.string().max(100),
        cargo_grau_texto: z.string().trim().min(1, 'cargo_grau_texto é obrigatório').max(100),
        cargo_nome: z.string().optional().nullable(),
        grau: z.string().optional().nullable(),
        cargo_estagio: z.string().optional().nullable(),
        ativo: z.boolean().optional().default(true),
        sgt_armas: z.boolean().optional(),
        caveira: z.boolean().optional(),
        caveira_suplente: z.boolean().optional(),
        batedor: z.boolean().optional(),
        ursinho: z.boolean().optional(),
        lobo: z.boolean().optional(),
        tem_moto: z.boolean().optional(),
        tem_carro: z.boolean().optional(),
        data_entrada: z.string().optional().nullable()
      })).optional(),
      atualizados: z.array(z.any()).optional() // Permite qualquer objeto já que contém múltiplos campos dinâmicos
    });

    const { admin_user_id, novos, atualizados } = requestSchema.parse(await req.json());

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
      logError('admin-import-integrantes', roleError, { admin_user_id });
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
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
      
      // Validar cargo_grau_texto antes de inserir
      for (const item of uniqueNovos) {
        if (!item.cargo_grau_texto || item.cargo_grau_texto.trim() === '') {
          console.error('[admin-import-integrantes] ❌ Registro sem cargo_grau_texto:', {
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            cargo_grau_texto: item.cargo_grau_texto,
            all_fields: Object.keys(item)
          });
        }
      }
      
      const { error: upsertError } = await supabase
        .from('integrantes_portal')
        .upsert(uniqueNovos, { 
          onConflict: 'registro_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        logError('admin-import-integrantes', upsertError, { count: uniqueNovos.length });
        return new Response(
          JSON.stringify({ error: handleDatabaseError(upsertError) }),
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
          logError('admin-import-integrantes', updateError, { id });
          return new Response(
            JSON.stringify({ error: handleDatabaseError(updateError) }),
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
      tipo: 'completo',
      integrantes: (integrantesAtivos || []).map(i => ({
        registro_id: i.registro_id,
        nome_colete: i.nome_colete,
        divisao_texto: i.divisao_texto,
        regional_texto: i.regional_texto,
        comando_texto: i.comando_texto,
        vinculado: i.vinculado || false,
        cargo_grau_texto: i.cargo_grau_texto
      })),
      divisoes: Array.from(divisoesMap.values()),
      periodo: new Date().toISOString(),
      total_integrantes: integrantesAtivos?.length || 0
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
      // Create a map of registro_id -> integrante_id for correct ID mapping
      const registroToIdMap = new Map();
      
      for (const atualizado of atualizados) {
        const antigoIntegrante = dadosAntigos.get(atualizado.id);
        if (antigoIntegrante) {
          registroToIdMap.set(antigoIntegrante.registro_id, atualizado.id);
        }
      }

      const atualizacoesDetalhadas = [];

      for (const atualizado of atualizados) {
        const antigoIntegrante = dadosAntigos.get(atualizado.id);

        if (antigoIntegrante) {
          const mudancas = compararCampos(antigoIntegrante, atualizado);
          
          for (const mudanca of mudancas) {
            atualizacoesDetalhadas.push({
              carga_historico_id: cargaData.id,
              integrante_id: registroToIdMap.get(antigoIntegrante.registro_id) || atualizado.id,
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
    if (error instanceof z.ZodError) {
      logError('admin-import-integrantes', 'Validation error', { errors: error.errors });
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logError('admin-import-integrantes', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
