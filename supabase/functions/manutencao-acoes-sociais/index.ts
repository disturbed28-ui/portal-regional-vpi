import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalização igual ao frontend e backend - SEMPRE lowercase
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Gerar hash em Base64 - SEMPRE normalizado para lowercase
// Inclui tipo_acao e escopo para diferenciar múltiplas ações do mesmo responsável no mesmo dia
function gerarHashDeduplicacao(
  dataAcao: string, 
  divisao: string, 
  responsavel: string,
  tipoAcao: string,
  escopo: string
): string {
  const partes = [
    dataAcao,
    normalizeText(divisao),
    normalizeText(responsavel),
    normalizeText(tipoAcao),
    normalizeText(escopo),
  ];
  const stringParaHash = partes.join("|");
  return btoa(stringParaHash);
}

// Buscar divisão pelo nome - PREFERIR NOME MAIS CURTO (mais específico)
function buscarDivisaoPorNome(
  nomeNormalizado: string,
  integrantesMap: Map<string, string>,
  divisaoDefault: string
): string {
  // Busca exata primeiro - prioridade máxima
  if (integrantesMap.has(nomeNormalizado)) {
    return integrantesMap.get(nomeNormalizado)!;
  }

  // Busca parcial - coletar TODOS os matches e escolher o MENOR (mais específico)
  const matches: { nomeKey: string; divisaoTexto: string }[] = [];
  
  for (const [nomeKey, divisaoTexto] of integrantesMap) {
    if (nomeKey.startsWith(nomeNormalizado) || nomeNormalizado.startsWith(nomeKey)) {
      matches.push({ nomeKey, divisaoTexto });
    }
  }

  if (matches.length > 0) {
    // Ordenar por tamanho do nome (menor primeiro = mais específico)
    // Ex: "tom a-" (6) vence "tombado" (7)
    matches.sort((a, b) => a.nomeKey.length - b.nomeKey.length);
    console.log(`🔍 [Match] "${nomeNormalizado}" -> escolhido "${matches[0].nomeKey}" (${matches[0].divisaoTexto}) entre ${matches.length} matches`);
    return matches[0].divisaoTexto;
  }

  return divisaoDefault;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    console.log("🔧 [Manutenção] Iniciando manutenção de ações sociais...");

    // 1. Buscar todos os integrantes para lookup de divisão
    const { data: integrantes, error: integrantesError } = await supabase
      .from("integrantes_portal")
      .select("nome_colete, nome_colete_ascii, divisao_texto")
      .eq("ativo", true);

    if (integrantesError) {
      throw new Error(`Erro ao buscar integrantes: ${integrantesError.message}`);
    }

    // Criar mapa de nome -> divisão
    const integrantesMap = new Map<string, string>();
    (integrantes || []).forEach((i: any) => {
      const nomeNorm = normalizeText(i.nome_colete);
      const nomeAscii = normalizeText(i.nome_colete_ascii || "");
      if (nomeNorm) integrantesMap.set(nomeNorm, i.divisao_texto);
      if (nomeAscii && nomeAscii !== nomeNorm) integrantesMap.set(nomeAscii, i.divisao_texto);
    });

    console.log(`📊 [Manutenção] ${integrantesMap.size} integrantes carregados para lookup`);
    
    // Debug: mostrar alguns integrantes com "tom" no nome
    for (const [nome, divisao] of integrantesMap) {
      if (nome.includes('tom')) {
        console.log(`   - "${nome}" -> "${divisao}"`);
      }
    }

    // 2. Buscar todos os registros de ações sociais (incluindo tipo_acao e escopo para o novo hash)
    const { data: registros, error: registrosError } = await supabase
      .from("acoes_sociais_registros")
      .select("id, data_acao, responsavel_nome_colete, divisao_relatorio_texto, tipo_acao_nome_snapshot, escopo_acao, hash_deduplicacao, foi_reportada_em_relatorio, created_at")
      .order("created_at", { ascending: true }); // Mais antigos primeiro para manter o original

    if (registrosError) {
      throw new Error(`Erro ao buscar registros: ${registrosError.message}`);
    }

    console.log(`📊 [Manutenção] ${registros?.length || 0} registros encontrados`);

    // 3. Calcular data limite (7 dias atrás)
    const hoje = new Date();
    const dataLimite = new Date(hoje);
    dataLimite.setDate(dataLimite.getDate() - 7);
    const dataLimiteStr = dataLimite.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`📅 [Manutenção] Data limite para marcar como reportado: ${dataLimiteStr}`);

    // 4. Primeiro passo: Calcular divisão correta e hash normalizado para TODOS os registros
    // Isso é necessário para identificar duplicados corretamente
    const registrosProcessados: {
      id: string;
      created_at: string;
      data_acao: string;
      responsavel_nome_colete: string;
      divisao_atual: string;
      divisao_correta: string;
      hash_atual: string | null;
      hash_normalizado: string;
      foi_reportada_em_relatorio: boolean;
    }[] = [];

    for (const registro of registros || []) {
      const nomeNormalizado = normalizeText(registro.responsavel_nome_colete);
      
      // Buscar divisão correta - PREFERIR NOME MAIS CURTO
      const divisaoCorreta = buscarDivisaoPorNome(
        nomeNormalizado,
        integrantesMap,
        registro.divisao_relatorio_texto
      );

      // Calcular hash normalizado (sempre lowercase, com divisão correta, tipo_acao e escopo)
      const hashNormalizado = gerarHashDeduplicacao(
        registro.data_acao,
        divisaoCorreta,
        registro.responsavel_nome_colete,
        registro.tipo_acao_nome_snapshot || '',
        registro.escopo_acao || ''
      );

      registrosProcessados.push({
        id: registro.id,
        created_at: registro.created_at,
        data_acao: registro.data_acao,
        responsavel_nome_colete: registro.responsavel_nome_colete,
        divisao_atual: registro.divisao_relatorio_texto,
        divisao_correta: divisaoCorreta,
        hash_atual: registro.hash_deduplicacao,
        hash_normalizado: hashNormalizado,
        foi_reportada_em_relatorio: registro.foi_reportada_em_relatorio
      });
    }

    // 5. Identificar e deletar duplicados baseado no hash NORMALIZADO
    const hashToRecords = new Map<string, typeof registrosProcessados>();
    const idsParaDeletar: string[] = [];

    for (const registro of registrosProcessados) {
      if (!hashToRecords.has(registro.hash_normalizado)) {
        hashToRecords.set(registro.hash_normalizado, []);
      }
      hashToRecords.get(registro.hash_normalizado)!.push(registro);
    }

    // Identificar duplicados (manter o mais antigo de cada grupo)
    for (const [hash, records] of hashToRecords) {
      if (records.length > 1) {
        // Ordenar por data de criação (mais antigo primeiro)
        records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        // Marcar todos exceto o primeiro para deleção
        for (let i = 1; i < records.length; i++) {
          idsParaDeletar.push(records[i].id);
        }
      }
    }

    console.log(`🗑️ [Manutenção] ${idsParaDeletar.length} registros duplicados identificados para exclusão`);

    // Deletar duplicados em lotes
    let totalDeletados = 0;
    if (idsParaDeletar.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < idsParaDeletar.length; i += batchSize) {
        const batch = idsParaDeletar.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from("acoes_sociais_registros")
          .delete()
          .in("id", batch);

        if (deleteError) {
          console.error(`❌ [Manutenção] Erro ao deletar lote: ${deleteError.message}`);
        } else {
          totalDeletados += batch.length;
        }
      }
      console.log(`✅ [Manutenção] ${totalDeletados} registros duplicados deletados`);
    }

    // 6. Filtrar registros que NÃO foram deletados e atualizar
    const idsParaDeletarSet = new Set(idsParaDeletar);
    const registrosParaAtualizar = registrosProcessados.filter(r => !idsParaDeletarSet.has(r.id));

    console.log(`📊 [Manutenção] ${registrosParaAtualizar.length} registros restantes para atualização`);

    // 7. Processar cada registro restante
    let hashesAtualizados = 0;
    let divisoesCorrigidas = 0;
    let marcadosComoReportados = 0;
    let erros: string[] = [];

    for (const registro of registrosParaAtualizar) {
      try {
        // Verificar se é registro antigo (deve ser marcado como reportado)
        const deveMarcarComoReportado = registro.data_acao < dataLimiteStr && !registro.foi_reportada_em_relatorio;

        // Verificar se precisa atualizar
        const hashMudou = registro.hash_normalizado !== registro.hash_atual;
        const divisaoMudou = registro.divisao_correta !== registro.divisao_atual;

        if (hashMudou || deveMarcarComoReportado || divisaoMudou) {
          const updateData: any = {};
          
          if (hashMudou) {
            updateData.hash_deduplicacao = registro.hash_normalizado;
          }
          
          if (divisaoMudou) {
            updateData.divisao_relatorio_texto = registro.divisao_correta;
            updateData.responsavel_divisao_texto = registro.divisao_correta;
            console.log(`🔄 [Manutenção] Corrigindo divisão de "${registro.responsavel_nome_colete}": "${registro.divisao_atual}" -> "${registro.divisao_correta}"`);
          }
          
          if (deveMarcarComoReportado) {
            updateData.foi_reportada_em_relatorio = true;
          }

          const { error: updateError } = await supabase
            .from("acoes_sociais_registros")
            .update(updateData)
            .eq("id", registro.id);

          if (updateError) {
            erros.push(`Erro ao atualizar ${registro.id}: ${updateError.message}`);
          } else {
            if (hashMudou) hashesAtualizados++;
            if (divisaoMudou) divisoesCorrigidas++;
            if (deveMarcarComoReportado) marcadosComoReportados++;
          }
        }
      } catch (err: any) {
        erros.push(`Erro no registro ${registro.id}: ${err.message}`);
      }
    }

    console.log(`✅ [Manutenção] Concluído:`);
    console.log(`   - Duplicados deletados: ${totalDeletados}`);
    console.log(`   - Hashes atualizados: ${hashesAtualizados}`);
    console.log(`   - Divisões corrigidas: ${divisoesCorrigidas}`);
    console.log(`   - Marcados como reportados: ${marcadosComoReportados}`);
    console.log(`   - Erros: ${erros.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_registros_inicial: registros?.length || 0,
        total_registros_final: registrosParaAtualizar.length,
        duplicados_deletados: totalDeletados,
        hashes_atualizados: hashesAtualizados,
        divisoes_corrigidas: divisoesCorrigidas,
        marcados_como_reportados: marcadosComoReportados,
        erros: erros.slice(0, 10), // Limitar a 10 erros no retorno
        total_erros: erros.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ [Manutenção] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});