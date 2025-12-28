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

/**
 * Função de normalização de texto: maiúsculo + sem acentos
 */
function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normaliza divisão para salvar no banco
 */
function normalizarDivisaoParaSalvar(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Se contém REGIONAL (caso Grau V), manter prefixo REGIONAL
  if (normalizado.includes('REGIONAL')) {
    normalizado = normalizado.replace(/^(DIVISAO\s+)?REGIONAL\s*/i, 'REGIONAL ');
  } else {
    // Garantir prefixo DIVISAO
    if (!normalizado.startsWith('DIVISAO')) {
      normalizado = 'DIVISAO ' + normalizado;
    }
  }
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza regional para salvar no banco
 */
function normalizarRegionalParaSalvar(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^REGIONAL\s*/, '');
  normalizado = 'REGIONAL ' + normalizado;
  
  // Garantir sufixo - SP
  if (!normalizado.endsWith('- SP')) {
    normalizado = normalizado.replace(/\s*-?\s*SP?\s*$/, '') + ' - SP';
  }
  
  return normalizado;
}

/**
 * Normaliza comando para salvar no banco
 */
function normalizarComandoParaSalvar(texto: string): string {
  if (!texto) return '';
  let normalizado = normalizarTexto(texto);
  
  // Remover prefixo existente e adicionar padronizado
  normalizado = normalizado.replace(/^COMANDO\s*/, '');
  normalizado = 'COMANDO ' + normalizado;
  
  return normalizado;
}

// Função para normalizar texto de divisão para busca (usado internamente)
function normalizarDivisaoTexto(texto: string): string {
  return texto
    .replace(/^DIVISAO\s*/i, '')
    .replace(/\s*-\s*SP$/i, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Normalizar texto de regional para busca (usado internamente)
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
// IMPORTANTE: Usa matching EXATO para evitar conflitos entre regionais similares
async function buscarIdsHierarquia(
  supabase: any,
  divisaoTexto: string,
  regionalTexto?: string
): Promise<HierarquiaIds> {
  // Verificar cache primeiro - incluir regionalTexto na chave para evitar conflitos
  const cacheKey = `${divisaoTexto.toLowerCase()}|${regionalTexto?.toLowerCase() || ''}`;
  if (cacheHierarquia.has(cacheKey)) {
    return cacheHierarquia.get(cacheKey)!;
  }
  
  console.log(`[HIERARQUIA] Buscando IDs para divisao="${divisaoTexto}" regional="${regionalTexto}"`);
  
  // Normalizar textos para comparação EXATA
  const divisaoNormalizada = normalizarDivisaoParaSalvar(divisaoTexto).toUpperCase();
  const divisaoUpper = divisaoTexto.toUpperCase();
  
  // Buscar todas as divisões e regionais uma vez
  const { data: divisoes } = await supabase
    .from('divisoes')
    .select('id, nome, regional_id')
    .order('nome');
  
  const { data: regionais } = await supabase
    .from('regionais')
    .select('id, nome')
    .order('nome');
  
  // CASO 1: CARGO REGIONAL (divisao_texto começa com "REGIONAL")
  if (divisaoUpper.startsWith('REGIONAL ') || divisaoUpper === 'REGIONAL') {
    console.log(`[HIERARQUIA] Detectado cargo regional: "${divisaoTexto}" | Regional do Excel: "${regionalTexto}"`);
    
    // 1) Buscar divisão com nome EXATAMENTE igual (ex: "REGIONAL VALE DO PARAIBA I - SP")
    const divisaoExata = divisoes?.find((d: any) => 
      d.nome.toUpperCase() === divisaoNormalizada
    );
    
    if (divisaoExata) {
      const resultado = {
        divisao_id: divisaoExata.id,
        regional_id: divisaoExata.regional_id
      };
      cacheHierarquia.set(cacheKey, resultado);
      console.log(`[HIERARQUIA] ✅ Divisão EXATA encontrada: "${divisaoNormalizada}" -> divisao_id=${resultado.divisao_id}, regional_id=${resultado.regional_id} (${divisaoExata.nome})`);
      return resultado;
    }
    
    // 2) Se não encontrou divisão, buscar regional pelo regional_texto do Excel (EXATO)
    if (regionalTexto) {
      // Extrair nome da regional sem prefixo/sufixo
      const regionalNormalizada = regionalTexto
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^REGIONAL\s*/, '')
        .replace(/\s*-\s*SP\s*$/, '')
        .trim();
      
      const regionalExata = regionais?.find((r: any) => {
        const nomeNorm = r.nome
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s*-\s*SP\s*$/, '')
          .trim();
        // Match EXATO: o nome normalizado deve ser igual
        return nomeNorm === regionalNormalizada;
      });
      
      if (regionalExata) {
        // Buscar se existe uma divisão "REGIONAL X - SP" para essa regional
        const divisaoRegional = divisoes?.find((d: any) => 
          d.regional_id === regionalExata.id && d.nome.toUpperCase().startsWith('REGIONAL ')
        );
        
        const resultado = {
          divisao_id: divisaoRegional?.id || null,
          regional_id: regionalExata.id
        };
        cacheHierarquia.set(cacheKey, resultado);
        console.log(`[HIERARQUIA] ✅ Regional EXATA encontrada via regional_texto: "${regionalTexto}" -> divisao_id=${resultado.divisao_id}, regional_id=${resultado.regional_id} (${regionalExata.nome})`);
        return resultado;
      }
    }
    
    console.warn(`[HIERARQUIA] ⚠️ Não encontrou divisão nem regional EXATA para: "${divisaoTexto}" / "${regionalTexto}"`);
    const resultadoVazio = { divisao_id: null, regional_id: null };
    cacheHierarquia.set(cacheKey, resultadoVazio);
    return resultadoVazio;
  }
  
  // CASO 2: DIVISÃO NORMAL (ex: "DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP")
  // Primeiro tentar match EXATO
  let divisaoEncontrada = divisoes?.find((d: any) => 
    d.nome.toUpperCase() === divisaoNormalizada
  );
  
  // Se não encontrou exato, tentar match por nome normalizado sem prefixo/sufixo
  if (!divisaoEncontrada) {
    const divisaoNorm = normalizarDivisaoTexto(divisaoTexto);
    divisaoEncontrada = divisoes?.find((d: any) => {
      const nomeNorm = normalizarDivisaoTexto(d.nome);
      // Match EXATO do nome normalizado (não usar includes!)
      return nomeNorm === divisaoNorm;
    });
  }
  
  if (divisaoEncontrada) {
    const resultado = {
      divisao_id: divisaoEncontrada.id,
      regional_id: divisaoEncontrada.regional_id  // Fonte de verdade!
    };
    cacheHierarquia.set(cacheKey, resultado);
    console.log(`[HIERARQUIA] ✅ ${divisaoTexto} -> divisao_id=${resultado.divisao_id}, regional_id=${resultado.regional_id} (${divisaoEncontrada.nome})`);
    return resultado;
  }
  
  console.warn(`[HIERARQUIA] ⚠️ Divisão não encontrada: "${divisaoTexto}"`);
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
          divisao_texto: normalizarDivisaoParaSalvar(novo.divisao_texto),
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
      
      // Enriquecer com IDs de divisão e regional + NORMALIZAR TEXTOS
      console.log('[admin-import-integrantes] Enriquecendo registros com IDs de hierarquia e normalizando textos...');
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
        
        // NORMALIZAR TEXTOS ANTES DE SALVAR
        novosEnriquecidos.push({
          ...item,
          divisao_texto: normalizarDivisaoParaSalvar(item.divisao_texto),
          regional_texto: normalizarRegionalParaSalvar(item.regional_texto),
          comando_texto: normalizarComandoParaSalvar(item.comando_texto),
          divisao_id: hierarquia.divisao_id,
          regional_id: hierarquia.regional_id
        });
      }
      
      console.log('[admin-import-integrantes] Registros enriquecidos e normalizados:', novosEnriquecidos.length);
      
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
        
        // Enriquecer com IDs de hierarquia + NORMALIZAR TEXTOS se houver divisao_texto
        let updateDataEnriquecido = { ...updateData };
        
        // NORMALIZAR TEXTOS ANTES DE SALVAR
        if (updateData.divisao_texto) {
          updateDataEnriquecido.divisao_texto = normalizarDivisaoParaSalvar(updateData.divisao_texto);
        }
        if (updateData.regional_texto) {
          updateDataEnriquecido.regional_texto = normalizarRegionalParaSalvar(updateData.regional_texto);
        }
        if (updateData.comando_texto) {
          updateDataEnriquecido.comando_texto = normalizarComandoParaSalvar(updateData.comando_texto);
        }
        
        // Buscar IDs de hierarquia
        if (updateData.divisao_texto) {
          const hierarquia = await buscarIdsHierarquia(supabase, updateData.divisao_texto, updateData.regional_texto);
          updateDataEnriquecido.divisao_id = hierarquia.divisao_id;
          updateDataEnriquecido.regional_id = hierarquia.regional_id;
          
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

        // SEMPRE sincronizar profile vinculado com regional_id e divisao_id
        if (oldData?.profile_id && (updateDataEnriquecido.regional_id || updateDataEnriquecido.divisao_id)) {
          const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
          
          if (updateDataEnriquecido.regional_id) {
            profileUpdate.regional_id = updateDataEnriquecido.regional_id;
          }
          if (updateDataEnriquecido.divisao_id) {
            profileUpdate.divisao_id = updateDataEnriquecido.divisao_id;
          }
          
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', oldData.profile_id);
          
          if (profileUpdateError) {
            console.error('[admin-import-integrantes] Erro ao sincronizar profile:', profileUpdateError);
          } else {
            console.log(`[PROFILE_SYNC] ${oldData.profile_id} -> regional_id=${profileUpdate.regional_id}, divisao_id=${profileUpdate.divisao_id}`);
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
