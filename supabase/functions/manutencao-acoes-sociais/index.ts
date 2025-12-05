import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalização igual ao frontend e backend
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Gerar hash em Base64 (igual ao backend import-acoes-sociais)
function gerarHashDeduplicacao(dataAcao: string, divisao: string, responsavel: string): string {
  const partes = [
    dataAcao,
    normalizeText(divisao),
    normalizeText(responsavel),
  ];
  const stringParaHash = partes.join("|");
  return btoa(stringParaHash);
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

    // 2. Buscar todos os registros de ações sociais
    const { data: registros, error: registrosError } = await supabase
      .from("acoes_sociais_registros")
      .select("id, data_acao, responsavel_nome_colete, divisao_relatorio_texto, hash_deduplicacao, foi_reportada_em_relatorio");

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

    // 4. Processar cada registro
    let hashesAtualizados = 0;
    let marcadosComoReportados = 0;
    let erros: string[] = [];

    for (const registro of registros || []) {
      try {
        const nomeNormalizado = normalizeText(registro.responsavel_nome_colete);
        
        // Buscar divisão correta pelo nome do responsável
        let divisaoCorreta = registro.divisao_relatorio_texto;
        
        // Busca exata primeiro
        if (integrantesMap.has(nomeNormalizado)) {
          divisaoCorreta = integrantesMap.get(nomeNormalizado)!;
        } else {
          // Busca parcial
          for (const [nomeKey, divisaoTexto] of integrantesMap) {
            if (nomeKey.includes(nomeNormalizado) || nomeNormalizado.includes(nomeKey)) {
              divisaoCorreta = divisaoTexto;
              break;
            }
          }
        }

        // Calcular novo hash
        const novoHash = gerarHashDeduplicacao(
          registro.data_acao,
          divisaoCorreta,
          registro.responsavel_nome_colete
        );

        // Verificar se é registro antigo (deve ser marcado como reportado)
        const dataAcao = registro.data_acao;
        const deveMarcarComoReportado = dataAcao < dataLimiteStr && !registro.foi_reportada_em_relatorio;

        // Verificar se precisa atualizar
        const hashMudou = novoHash !== registro.hash_deduplicacao;
        const divisaoMudou = divisaoCorreta !== registro.divisao_relatorio_texto;

        if (hashMudou || deveMarcarComoReportado || divisaoMudou) {
          const updateData: any = {};
          
          if (hashMudou) {
            updateData.hash_deduplicacao = novoHash;
          }
          
          if (divisaoMudou) {
            updateData.divisao_relatorio_texto = divisaoCorreta;
            updateData.responsavel_divisao_texto = divisaoCorreta;
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
            if (deveMarcarComoReportado) marcadosComoReportados++;
          }
        }
      } catch (err: any) {
        erros.push(`Erro no registro ${registro.id}: ${err.message}`);
      }
    }

    console.log(`✅ [Manutenção] Concluído:`);
    console.log(`   - Hashes atualizados: ${hashesAtualizados}`);
    console.log(`   - Marcados como reportados: ${marcadosComoReportados}`);
    console.log(`   - Erros: ${erros.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_registros: registros?.length || 0,
        hashes_atualizados: hashesAtualizados,
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
