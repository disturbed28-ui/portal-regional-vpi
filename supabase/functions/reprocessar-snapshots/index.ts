import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🔄 Iniciando reprocessamento de snapshots...');

    // Buscar todas as cargas históricas
    const { data: cargas, error: fetchError } = await supabaseClient
      .from('cargas_historico')
      .select('id, dados_snapshot, data_carga')
      .order('data_carga');

    if (fetchError) throw fetchError;

    console.log(`📦 Encontradas ${cargas.length} cargas para processar`);

    let reprocessados = 0;
    let jaCorretos = 0;
    let erros = 0;

    for (const carga of cargas) {
      const snapshot = carga.dados_snapshot as any;
      
      // Verificar se precisa reprocessar (formato antigo)
      if (snapshot.integrantes && !snapshot.divisoes) {
        console.log(`🔧 Reprocessando carga ${carga.id} de ${carga.data_carga}...`);
        
        try {
          // Agrupar por divisão
          const divisoesMap = new Map<string, { nome: string; total_atual: number }>();
          
          snapshot.integrantes.forEach((integrante: any) => {
            const divisao = integrante.divisao_texto;
            if (!divisoesMap.has(divisao)) {
              divisoesMap.set(divisao, { nome: divisao, total_atual: 0 });
            }
            divisoesMap.get(divisao)!.total_atual++;
          });
          
          const novoSnapshot = {
            divisoes: Array.from(divisoesMap.values())
          };
          
          console.log(`📊 Snapshot reprocessado: ${novoSnapshot.divisoes.length} divisões`);
          
          // Atualizar no banco
          const { error: updateError } = await supabaseClient
            .from('cargas_historico')
            .update({ dados_snapshot: novoSnapshot })
            .eq('id', carga.id);
          
          if (updateError) {
            console.error(`❌ Erro ao atualizar carga ${carga.id}:`, updateError);
            erros++;
          } else {
            console.log(`✅ Carga ${carga.id} reprocessada com sucesso`);
            reprocessados++;
          }
        } catch (error) {
          console.error(`💥 Erro ao processar carga ${carga.id}:`, error);
          erros++;
        }
      } else if (snapshot.divisoes) {
        console.log(`⏭️  Carga ${carga.id} já está no formato correto`);
        jaCorretos++;
      } else {
        console.warn(`⚠️  Carga ${carga.id} tem formato inesperado:`, snapshot);
      }
    }

    const resultado = {
      success: true,
      message: `Reprocessamento concluído: ${reprocessados} atualizadas, ${jaCorretos} já corretas, ${erros} erros`,
      reprocessados,
      jaCorretos,
      erros,
      total: cargas.length,
    };

    console.log('✅ Resultado final:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro no reprocessamento:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
