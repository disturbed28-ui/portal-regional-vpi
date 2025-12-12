import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleDatabaseError, logError } from '../_shared/error-handler.ts'

interface CampoAlterado {
  campo: string;
  anterior: string;
  novo: string;
}

interface HierarquiaIds {
  divisao_id: string | null;
  regional_id: string | null;
}

// Cache para evitar queries repetidas
const cacheHierarquia = new Map<string, HierarquiaIds>();

// Função para normalizar texto de divisão para busca
function normalizarDivisaoTexto(texto: string): string {
  return texto
    .replace(/^DIVISAO\s*/i, '')
    .replace(/\s*-\s*SP$/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Normalizar texto de regional para busca
function normalizarRegionalTexto(texto: string): string {
  return texto
    .replace(/^REGIONAL\s*/i, '')
    .replace(/\s*-\s*SP$/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Buscar IDs de divisão e regional baseado no texto da divisão
async function buscarIdsHierarquia(
  supabase: any,
  divisaoTexto: string,
  regionalTexto?: string
): Promise<HierarquiaIds> {
  // Verificar cache primeiro
  const cacheKey = divisaoTexto.toLowerCase();
  if (cacheHierarquia.has(cacheKey)) {
    return cacheHierarquia.get(cacheKey)!;
  }
  
  // 🆕 VERIFICAR SE É CARGO REGIONAL (divisao_texto contém "REGIONAL" no início)
  const divisaoUpper = divisaoTexto.toUpperCase();
  if (divisaoUpper.startsWith('REGIONAL ') || divisaoUpper === 'REGIONAL') {
    console.log(`[HIERARQUIA] Detectado cargo regional: "${divisaoTexto}"`);
    
    // Para cargos regionais, buscar diretamente na tabela regionais
    const regionalParaBuscar = regionalTexto || divisaoTexto;
    const regionalNorm = normalizarRegionalTexto(regionalParaBuscar);
    
    const { data: regionais } = await supabase
      .from('regionais')
      .select('id, nome, nome_ascii')
      .order('nome');
    
    if (regionais && regionais.length > 0) {
      // Tentar match
      const regionalEncontrada = regionais.find((r: any) => {
        const nomeNorm = normalizarRegionalTexto(r.nome);
        const asciiNorm = r.nome_ascii ? r.nome_ascii.toLowerCase() : '';
        return nomeNorm === regionalNorm || 
               nomeNorm.includes(regionalNorm) || 
               regionalNorm.includes(nomeNorm) ||
               asciiNorm.includes(regionalNorm) ||
               regionalNorm.includes(asciiNorm);
      });
      
      if (regionalEncontrada) {
        const resultado = {
          divisao_id: null,  // Cargos regionais não têm divisão
          regional_id: regionalEncontrada.id
        };
        cacheHierarquia.set(cacheKey, resultado);
        console.log(`[HIERARQUIA] Cargo regional: ${divisaoTexto} -> regional_id=${resultado.regional_id} (${regionalEncontrada.nome})`);
        return resultado;
      }
    }
    
    console.warn(`[HIERARQUIA] Regional não encontrada para cargo regional: "${divisaoTexto}" / "${regionalParaBuscar}"`);
    const resultadoVazio = { divisao_id: null, regional_id: null };
    cacheHierarquia.set(cacheKey, resultadoVazio);
    return resultadoVazio;
  }
  
  // Para divisões normais, buscar na tabela divisoes
  const divisaoNorm = normalizarDivisaoTexto(divisaoTexto);
  
  // Buscar divisão pelo nome (fonte de verdade para regional_id)
  const { data: divisoes } = await supabase
    .from('divisoes')
    .select('id, nome, regional_id, nome_ascii')
    .order('nome');
  
  if (divisoes && divisoes.length > 0) {
    // Tentar match exato primeiro
    let divisaoEncontrada = divisoes.find((d: any) => {
      const nomeNorm = normalizarDivisaoTexto(d.nome);
      return nomeNorm === divisaoNorm;
    });
    
    // Se não encontrou, tentar match parcial
    if (!divisaoEncontrada) {
      divisaoEncontrada = divisoes.find((d: any) => {
        const nomeNorm = normalizarDivisaoTexto(d.nome);
        const asciiNorm = d.nome_ascii ? d.nome_ascii.toLowerCase() : '';
        return nomeNorm.includes(divisaoNorm) || 
               divisaoNorm.includes(nomeNorm) ||
               asciiNorm.includes(divisaoNorm) ||
               divisaoNorm.includes(asciiNorm);
      });
    }
    
    if (divisaoEncontrada) {
      const resultado = {
        divisao_id: divisaoEncontrada.id,
        regional_id: divisaoEncontrada.regional_id  // Fonte de verdade!
      };
      cacheHierarquia.set(cacheKey, resultado);
      console.log(`[HIERARQUIA] ${divisaoTexto} -> divisao_id=${resultado.divisao_id}, regional_id=${resultado.regional_id}`);
      return resultado;
    }
  }
  
  console.warn(`[HIERARQUIA] Divisão não encontrada: "${divisaoTexto}"`);
  const resultadoVazio = { divisao_id: null, regional_id: null };
  cacheHierarquia.set(cacheKey, resultadoVazio);
  return resultadoVazio;
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
      atualizados: z.array(z.any()).optional(),
      removidos: z.array(z.object({
        integrante_id: z.string().uuid(),
        registro_id: z.number(),
        nome_colete: z.string(),
        motivo_inativacao: z.enum(['transferido', 'falecido', 'desligado', 'expulso', 'afastado', 'promovido', 'outro']),
        observacao_inativacao: z.string().optional()
      })).optional()
    });

    const { admin_user_id, novos, atualizados, removidos } = requestSchema.parse(await req.json());

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
    let inativadosCount = 0;
    const deltasPendentes: any[] = [];

    // Detectar novos ativos
    const { data: ativosAtuais } = await supabase
      .from('integrantes_portal')
      .select('registro_id')
      .eq('ativo', true);
    
    const registrosAtuais = new Set(ativosAtuais?.map(a => a.registro_id) || []);

    novos?.forEach(novo => {
      if (!registrosAtuais.has(novo.registro_id)) {
        console.log(`[DELTA] Novo ativo: ${novo.nome_colete} (${novo.registro_id})`);
        
        deltasPendentes.push({
          registro_id: novo.registro_id,
          nome_colete: novo.nome_colete,
          divisao_texto: novo.divisao_texto,
          tipo_delta: 'NOVO_ATIVOS',
          prioridade: 0,
          dados_adicionais: { 
            cargo: novo.cargo_grau_texto,
            data_entrada: novo.data_entrada
          }
        });
      }
    });

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
      
      // Enriquecer com IDs de divisão e regional (buscar da tabela divisoes)
      console.log('[admin-import-integrantes] Enriquecendo registros com IDs de hierarquia...');
      const novosEnriquecidos = [];
      
      for (const item of uniqueNovos) {
        // Validar cargo_grau_texto
        if (!item.cargo_grau_texto || item.cargo_grau_texto.trim() === '') {
          console.error('[admin-import-integrantes] ❌ Registro sem cargo_grau_texto:', {
            registro_id: item.registro_id,
            nome_colete: item.nome_colete,
            cargo_grau_texto: item.cargo_grau_texto,
            all_fields: Object.keys(item)
          });
        }
        
        // Buscar IDs de hierarquia baseado no texto da divisão e regional
        const hierarquia = await buscarIdsHierarquia(supabase, item.divisao_texto, item.regional_texto);
        
        novosEnriquecidos.push({
          ...item,
          divisao_id: hierarquia.divisao_id,
          regional_id: hierarquia.regional_id
        });
      }
      
      console.log('[admin-import-integrantes] Registros enriquecidos:', novosEnriquecidos.length);
      
      const { error: upsertError } = await supabase
        .from('integrantes_portal')
        .upsert(novosEnriquecidos, { 
          onConflict: 'registro_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        logError('admin-import-integrantes', upsertError, { count: novosEnriquecidos.length });
        return new Response(
          JSON.stringify({ error: handleDatabaseError(upsertError) }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedCount = novosEnriquecidos.length;
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
        
        // Enriquecer com IDs de hierarquia se houver divisao_texto
        let updateDataEnriquecido = { ...updateData };
        if (updateData.divisao_texto) {
          const hierarquia = await buscarIdsHierarquia(supabase, updateData.divisao_texto, updateData.regional_texto);
          updateDataEnriquecido = {
            ...updateData,
            divisao_id: hierarquia.divisao_id,
            regional_id: hierarquia.regional_id
          };
          
          // Log se houver mudança de regional
          if (oldData && oldData.regional_id !== hierarquia.regional_id) {
            console.log(`[MUDANÇA_REGIONAL] ${updateData.nome_colete || oldData.nome_colete}: ${oldData.regional_id} -> ${hierarquia.regional_id}`);
          }
        }
        
        const { error: updateError } = await supabase
          .from('integrantes_portal')
          .update(updateDataEnriquecido)
          .eq('id', id);

        if (updateError) {
          logError('admin-import-integrantes', updateError, { id });
          return new Response(
            JSON.stringify({ error: handleDatabaseError(updateError) }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se mudou de regional, atualizar também o profile vinculado
        if (updateDataEnriquecido.regional_id && oldData?.profile_id && oldData.regional_id !== updateDataEnriquecido.regional_id) {
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ 
              regional_id: updateDataEnriquecido.regional_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', oldData.profile_id);
          
          if (profileUpdateError) {
            console.error('[admin-import-integrantes] Erro ao atualizar profile regional:', profileUpdateError);
          } else {
            console.log(`[PROFILE_ATUALIZADO] ${oldData.profile_id} -> regional_id = ${updateDataEnriquecido.regional_id}`);
          }
        }

        updatedCount++;
      }
    }

    // Process removals (inactivations)
    if (removidos && removidos.length > 0) {
      for (const removido of removidos) {
        const { error: inactivateError } = await supabase
          .from('integrantes_portal')
          .update({
            ativo: false,
            motivo_inativacao: removido.motivo_inativacao,
            data_inativacao: new Date().toISOString(),
            observacoes: removido.observacao_inativacao || null
          })
          .eq('id', removido.integrante_id);

        if (inactivateError) {
          console.error('[admin-import-integrantes] Error inactivating:', inactivateError);
        } else {
          inativadosCount++;
          
          // Log to history
          await supabase.from('integrantes_historico').insert({
            integrante_id: removido.integrante_id,
            acao: 'inativacao',
            dados_anteriores: { ativo: true },
            dados_novos: { 
              ativo: false,
              motivo_inativacao: removido.motivo_inativacao 
            },
            observacao: removido.observacao_inativacao,
            alterado_por: admin_user_id
          });
        }
      }
    }

    console.log('[admin-import-integrantes] Success - Inserted:', insertedCount, 'Updated:', updatedCount, 'Inativados:', inativadosCount);

    // Atribuir roles automaticamente aos integrantes novos e atualizados
    const integrantesParaAtribuirRoles = [
      ...(novos || []).map(n => ({ registro_id: n.registro_id, cargo_grau_texto: n.cargo_grau_texto })),
      ...(atualizados || []).map(a => ({ registro_id: a.registro_id, cargo_grau_texto: a.cargo_grau_texto }))
    ];

    for (const integrante of integrantesParaAtribuirRoles) {
      try {
        // Buscar profile_id pelo registro_id
        const { data: integranteData } = await supabase
          .from('integrantes_portal')
          .select('profile_id, cargo_grau_texto')
          .eq('registro_id', integrante.registro_id)
          .single();
        
        if (integranteData?.profile_id) {
          const cargoGrauTexto = integranteData.cargo_grau_texto;
          
          // Remover roles antigas (exceto admin)
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', integranteData.profile_id)
            .neq('role', 'admin');

          let novaRole: string | null = null;

          // Prioridade 1: Diretor/Subdiretor
          if (cargoGrauTexto.includes('Diretor') || cargoGrauTexto.includes('Sub Diretor') || cargoGrauTexto.includes('Sub-Diretor')) {
            novaRole = 'diretor_divisao';
          }
          // Prioridade 2: Grau V (Regional)
          else if (cargoGrauTexto.includes('Grau V')) {
            novaRole = 'regional';
          }
          // Prioridade 3: Grau VI (Moderador)
          else if (cargoGrauTexto.includes('Grau VI')) {
            novaRole = 'moderator';
          }

          if (novaRole) {
            await supabase
              .from('user_roles')
              .upsert({ 
                user_id: integranteData.profile_id, 
                role: novaRole 
              }, { 
                onConflict: 'user_id,role' 
              });
            
            console.log(`[admin-import-integrantes] Role ${novaRole} atribuída a ${integranteData.profile_id}`);
          }
        }
      } catch (roleError) {
        console.error('[admin-import-integrantes] Erro ao atribuir role:', roleError);
        // Não bloquear a importação por erro de role
      }
    }

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
        tipo_carga: 'integrantes',
        realizado_por: admin_user_id,
        observacoes: `Importação: ${insertedCount} novos, ${updatedCount} atualizados, ${inativadosCount} inativados`
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

    // Salvar deltas detectados no banco
    if (deltasPendentes.length > 0) {
      console.log(`[admin-import-integrantes] Salvando ${deltasPendentes.length} deltas...`);
      
      // Buscar relações automáticas com SUMIU_AFASTADOS nas últimas 24h
      for (const delta of deltasPendentes) {
        if (delta.tipo_delta === 'NOVO_ATIVOS') {
          // Verificar se existe SUMIU_AFASTADOS com mesmo registro_id criado hoje
          const { data: sumiuAfastado } = await supabase
            .from('deltas_pendentes')
            .select('id')
            .eq('registro_id', delta.registro_id)
            .eq('tipo_delta', 'SUMIU_AFASTADOS')
            .eq('status', 'PENDENTE')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();
          
          if (sumiuAfastado) {
            console.log(`[RELACAO_DETECTADA] ${delta.nome_colete} retornou (sumiu afastados + apareceu ativos)`);
            
            // Marcar como RESOLVIDO
            await supabase
              .from('deltas_pendentes')
              .update({ 
                status: 'RESOLVIDO', 
                observacao_admin: 'Retorno detectado automaticamente',
                resolvido_por: 'system',
                resolvido_em: new Date().toISOString()
              })
              .eq('id', sumiuAfastado.id);
            
            // Não criar o delta NOVO_ATIVOS
            continue;
          }
        }
        
        // Criar delta normal
        await supabase
          .from('deltas_pendentes')
          .insert({
            ...delta,
            carga_id: cargaData.id,
            status: 'PENDENTE'
          });
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
        },
        deltasGerados: deltasPendentes.length,
        deltas: deltasPendentes.slice(0, 5)
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
