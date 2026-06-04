import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CAMPOS = `
- nome_completo: nome completo do candidato
- nome_colete: como gostaria de ser chamado / nome de guerra / nome no colete
- telefone: telefone celular (apenas dígitos com DDD)
- cpf: CPF (apenas dígitos)
- rg: RG, se houver
- nascimento: data de nascimento no formato DD/MM/AAAA
- profissao: profissão
- email: e-mail
- endereco_rua: rua/logradouro
- endereco_bairro: bairro
- endereco_cidade: cidade
- endereco_estado: estado (UF)
- endereco_cep: CEP
- tamanho_camiseta: tamanho da camisa/camiseta
- colete_tipo: tipo de colete (Couro ou Jeans)
- tamanho_colete: tamanho do colete
- forma_pagamento: forma de pagamento, se houver
- contato_emergencia: contato de emergência, se houver
- comando_responsavel: comando responsável
- diretor_regional_responsavel: diretor regional responsável
- expansao_nome: nome do representante da Expansão que enviou a ficha (quem assina/encaminha), se houver
- expansao_telefone: telefone do representante da Expansão, se houver
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const fichaText: string | undefined = body?.ficha_text;
    const pdfBase64: string | undefined = body?.pdf_base64;

    if (!fichaText && !pdfBase64) {
      return new Response(JSON.stringify({ error: "Envie ficha_text ou pdf_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "Você é um assistente que extrai dados de fichas de cadastro de novos integrantes de um motoclube. " +
      "Receberá o conteúdo de uma ficha (texto livre ou PDF) e deve identificar os campos solicitados. " +
      "Responda APENAS com um objeto JSON válido contendo exatamente estas chaves: " +
      CAMPOS +
      "\nRegras: se um campo não for encontrado, use null. Não invente dados. " +
      "Telefone e CPF apenas com dígitos. Mantenha acentuação correta nos nomes.";

    const userContent: unknown[] = [];
    if (fichaText) {
      userContent.push({ type: "text", text: `Ficha:\n${fichaText}` });
    }
    if (pdfBase64) {
      userContent.push({ type: "text", text: "Extraia os dados da ficha em PDF a seguir:" });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: "Falha na IA", detail: txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const content: string = aiData?.choices?.[0]?.message?.content ?? "{}";

    let dados: Record<string, unknown> = {};
    try {
      dados = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          dados = JSON.parse(match[0]);
        } catch {
          dados = {};
        }
      }
    }

    return new Response(JSON.stringify({ dados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
