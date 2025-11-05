import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface AfastadoInput {
  registro_id: number;
  nome_colete: string;
  divisao_texto: string;
  cargo_grau_texto: string | null;
  tipo_afastamento: string;
  data_afastamento: string;
  data_retorno_prevista: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      throw new Error('Permissão negada. Apenas administradores podem importar afastados.');
    }

    const { afastados, observacoes } = await req.json() as { 
      afastados: AfastadoInput[], 
      observacoes?: string 
    };

    if (!afastados || !Array.isArray(afastados) || afastados.length === 0) {
      throw new Error('Nenhum afastado para processar');
    }

    console.log(`[admin-import-afastados] Iniciando importação de ${afastados.length} afastados`);

    let novos = 0;
    let atualizados = 0;
    const avisos: string[] = [];
    const deltasPendentes: any[] = [];

    // Buscar afastados ativos atuais para detectar deltas
    const { data: afastadosAtuais } = await supabase
      .from('integrantes_afastados')
      .select('registro_id, nome_colete, divisao_texto')
      .eq('ativo', true);
    
    const registrosNovaPlanilha = new Set(afastados.map(a => a.registro_id));
    const registrosAtuais = new Set(afastadosAtuais?.map(a => a.registro_id) || []);

    // Detectar quem sumiu dos afastados (provavelmente retornou)
    afastadosAtuais?.forEach(atual => {
      if (!registrosNovaPlanilha.has(atual.registro_id)) {
        console.log(`[DELTA] Sumiu dos afastados: ${atual.nome_colete} (${atual.registro_id})`);
        
        deltasPendentes.push({
          registro_id: atual.registro_id,
          nome_colete: atual.nome_colete,
          divisao_texto: atual.divisao_texto,
          tipo_delta: 'SUMIU_AFASTADOS',
          prioridade: 0,
          dados_adicionais: { origem: 'Estava afastado, não está mais na planilha' }
        });
      }
    });

    // Detectar novos afastados
    afastados.forEach(novo => {
      if (!registrosAtuais.has(novo.registro_id)) {
        console.log(`[DELTA] Novo afastado: ${novo.nome_colete} (${novo.registro_id})`);
        
        deltasPendentes.push({
          registro_id: novo.registro_id,
          nome_colete: novo.nome_colete,
          divisao_texto: novo.divisao_texto,
          tipo_delta: 'NOVO_AFASTADOS',
          prioridade: 0,
          dados_adicionais: { 
            tipo_afastamento: novo.tipo_afastamento,
            data_afastamento: novo.data_afastamento 
          }
        });
      }
    });

    // Criar registro em cargas_historico primeiro
    const { data: cargaHistorico, error: cargaError } = await supabase
      .from('cargas_historico')
      .insert({
        dados_snapshot: { afastados },
        total_integrantes: afastados.length,
        observacoes: observacoes || 'Carga de Integrantes Afastados Temporariamente',
        realizado_por: user.email || user.id,
      })
      .select()
      .single();

    if (cargaError) {
      console.error('[admin-import-afastados] Erro ao criar carga histórico:', cargaError);
      throw new Error('Erro ao registrar histórico de carga');
    }

    // Processar cada afastado
    for (const afastado of afastados) {
      try {
        // Verificar se já existe afastamento ativo para esse registro_id
        const { data: existente } = await supabase
          .from('integrantes_afastados')
          .select('id, ativo')
          .eq('registro_id', afastado.registro_id)
          .eq('ativo', true)
          .maybeSingle();

        // Sempre manter como ativo durante a importação
        // O afastamento só deve ser marcado como inativo quando houver retorno efetivo registrado
        const ativo = true;

        const afastadoData = {
          registro_id: afastado.registro_id,
          nome_colete: afastado.nome_colete,
          divisao_texto: afastado.divisao_texto,
          cargo_grau_texto: afastado.cargo_grau_texto,
          tipo_afastamento: afastado.tipo_afastamento,
          data_afastamento: afastado.data_afastamento,
          data_retorno_prevista: afastado.data_retorno_prevista,
          ativo,
          carga_historico_id: cargaHistorico.id,
        };

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('integrantes_afastados')
            .update(afastadoData)
            .eq('id', existente.id);

          if (updateError) {
            console.error(`[admin-import-afastados] Erro ao atualizar ${afastado.nome_colete}:`, updateError);
            avisos.push(`Erro ao atualizar ${afastado.nome_colete}`);
          } else {
            atualizados++;
            console.log(`[admin-import-afastados] Atualizado: ${afastado.nome_colete}`);
          }
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('integrantes_afastados')
            .insert(afastadoData);

          if (insertError) {
            console.error(`[admin-import-afastados] Erro ao inserir ${afastado.nome_colete}:`, insertError);
            avisos.push(`Erro ao inserir ${afastado.nome_colete}`);
          } else {
            novos++;
            console.log(`[admin-import-afastados] Novo: ${afastado.nome_colete}`);
          }
        }

        // Verificar se integrante existe em integrantes_portal
        const { data: integrantePortal } = await supabase
          .from('integrantes_portal')
          .select('id, ativo')
          .eq('registro_id', afastado.registro_id)
          .maybeSingle();

        if (!integrantePortal) {
          avisos.push(`Integrante ${afastado.nome_colete} (${afastado.registro_id}) não encontrado em integrantes_portal`);
        }
      } catch (error) {
        console.error(`[admin-import-afastados] Erro ao processar ${afastado.nome_colete}:`, error);
        avisos.push(`Erro ao processar ${afastado.nome_colete}`);
      }
    }

    // Salvar deltas detectados no banco
    if (deltasPendentes.length > 0) {
      console.log(`[admin-import-afastados] Salvando ${deltasPendentes.length} deltas...`);
      
      // Buscar relações automáticas com NOVO_ATIVOS nas últimas 24h
      for (const delta of deltasPendentes) {
        if (delta.tipo_delta === 'SUMIU_AFASTADOS') {
          // Verificar se existe NOVO_ATIVOS com mesmo registro_id criado hoje
          const { data: novoAtivo } = await supabase
            .from('deltas_pendentes')
            .select('id')
            .eq('registro_id', delta.registro_id)
            .eq('tipo_delta', 'NOVO_ATIVOS')
            .eq('status', 'PENDENTE')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();
          
          if (novoAtivo) {
            console.log(`[RELACAO_DETECTADA] ${delta.nome_colete} retornou (sumiu afastados + apareceu ativos)`);
            
            // Marcar ambos como RESOLVIDO
            await supabase
              .from('deltas_pendentes')
              .update({ 
                status: 'RESOLVIDO', 
                observacao_admin: 'Retorno detectado automaticamente',
                resolvido_por: 'system',
                resolvido_em: new Date().toISOString()
              })
              .eq('id', novoAtivo.id);
            
            // Não criar o delta SUMIU_AFASTADOS
            continue;
          }
        }
        
        // Criar delta normal
        await supabase
          .from('deltas_pendentes')
          .insert({
            ...delta,
            carga_id: cargaHistorico.id,
            status: 'PENDENTE'
          });
      }
    }

    const resultado = {
      sucesso: true,
      total: afastados.length,
      novos,
      atualizados,
      avisos,
      carga_id: cargaHistorico.id,
      deltasGerados: deltasPendentes.length,
      deltas: deltasPendentes.slice(0, 5) // Preview dos primeiros 5
    };

    console.log('[admin-import-afastados] Importação concluída:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-import-afastados] Erro:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
