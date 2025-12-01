import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnviarFormPayload {
  registro_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar JWT e obter user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[enviar-form] Erro de autenticação:', authError);
      throw new Error('Não autenticado');
    }

    const { registro_id } = await req.json() as EnviarFormPayload;

    if (!registro_id) {
      throw new Error('registro_id é obrigatório');
    }

    console.log(`[enviar-form] Processando registro ${registro_id} para usuário ${user.id}`);

    // Buscar registro
    const { data: registro, error: registroError } = await supabase
      .from('acoes_sociais_registros')
      .select('*')
      .eq('id', registro_id)
      .single();

    if (registroError || !registro) {
      console.error('[enviar-form] Erro ao buscar registro:', registroError);
      throw new Error('Registro não encontrado');
    }

    // Verificar ownership
    if (registro.profile_id !== user.id) {
      throw new Error('Você não tem permissão para enviar este registro');
    }

    // Verificar se já foi enviado
    if (registro.google_form_status === 'enviado') {
      throw new Error('Este registro já foi enviado ao formulário');
    }

    // Buscar todas as configurações ativas
    const { data: configs, error: configError } = await supabase
      .from('acoes_sociais_config_regional')
      .select('email_formulario, regional_texto')
      .eq('ativo', true);

    if (configError) {
      console.error('[enviar-form] Erro ao buscar configs:', configError);
      throw new Error('Erro ao buscar configurações de email');
    }

    // Função para normalizar texto de regional
    const normalizeRegional = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\bi\b/g, '1')
        .replace(/\bii\b/g, '2')
        .replace(/\biii\b/g, '3')
        .replace(/\biv\b/g, '4')
        .replace(/\bv\b/g, '5');
    };

    // Encontrar config com match normalizado
    const registroRegionalNorm = normalizeRegional(registro.regional_relatorio_texto);
    const config = configs?.find(c => 
      normalizeRegional(c.regional_texto) === registroRegionalNorm
    );

    if (!config) {
      console.error('[enviar-form] Nenhuma config encontrada para:', {
        original: registro.regional_relatorio_texto,
        normalizado: registroRegionalNorm,
        configsDisponiveis: configs?.map(c => ({
          original: c.regional_texto,
          normalizado: normalizeRegional(c.regional_texto)
        }))
      });
      throw new Error(`Configuração de email não encontrada para a regional: ${registro.regional_relatorio_texto}`);
    }

    console.log('[enviar-form] ✅ Config encontrada:', {
      registroRegional: registro.regional_relatorio_texto,
      configRegional: config.regional_texto,
      email: config.email_formulario
    });

    // Extrair ano, mês e dia da data_acao
    const dataAcao = new Date(registro.data_acao);
    const ano = dataAcao.getFullYear();
    const mes = dataAcao.getMonth() + 1; // Janeiro = 1
    const dia = dataAcao.getDate();

    // Mapear escopo_acao para texto exato do formulário Google
    const mapearEscopo = (escopo: string): string => {
      const mapeamento: Record<string, string> = {
        'interna': 'Interna ( ajuda ao integrante)',
        'externa': 'Externa',
      };
      return mapeamento[escopo?.toLowerCase()] || escopo || '';
    };

    const escopoFormulario = mapearEscopo(registro.escopo_acao);

    // Montar payload para Google Forms (com mapeamento correto)
    const formData = new URLSearchParams({
      'emailAddress': config.email_formulario,
      'entry.1698025551_year': ano.toString(),
      'entry.1698025551_month': mes.toString(),
      'entry.1698025551_day': dia.toString(),
      'entry.1818867636': registro.regional_relatorio_texto || '',    // Regional
      'entry.354405432': registro.divisao_relatorio_texto || '',      // Divisão
      'entry.577779066': registro.responsavel_nome_colete || '',      // Responsável
      'entry.122607591': registro.descricao_acao || '',               // Descrição
      'entry.1873990495': escopoFormulario,                           // Escopo (mapeado)
      'entry.2045537139': registro.tipo_acao_nome_snapshot || '',     // Tipo de Ação
    });

    console.log('[enviar-form] Enviando para Google Forms...', {
      dadosEnviados: Object.fromEntries(formData)
    });

    // Enviar para Google Forms
    const formResponse = await fetch(
      'https://docs.google.com/forms/d/e/1FAIpQLScgIgriBBDQpzI5h3JdHia6-RL2zz8kl3pWNsZA9P8kkob2UA/formResponse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    // Capturar detalhes da resposta para debug
    const responseBody = await formResponse.text();

    console.log('[enviar-form] Resposta Google Forms:', {
      status: formResponse.status,
      statusText: formResponse.statusText,
      bodyPreview: responseBody.substring(0, 500)
    });

    // Se erro, logar detalhes e retornar
    if (formResponse.status >= 400) {
      console.error('[enviar-form] ❌ Erro do Google Forms:', {
        status: formResponse.status,
        statusText: formResponse.statusText,
        body: responseBody
      });

      // Atualizar status como erro
      await supabase
        .from('acoes_sociais_registros')
        .update({ google_form_status: 'erro' })
        .eq('id', registro_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao enviar para o formulário do Google',
          details: {
            status: formResponse.status,
            statusText: formResponse.statusText
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Google Forms retorna 200 em caso de sucesso
    const sucesso = formResponse.status < 400;

    // Atualizar status do registro
    const { error: updateError } = await supabase
      .from('acoes_sociais_registros')
      .update({
        google_form_status: sucesso ? 'enviado' : 'erro',
        google_form_enviado_em: sucesso ? new Date().toISOString() : null,
        google_form_enviado_por: sucesso ? user.id : null,
      })
      .eq('id', registro_id);

    if (updateError) {
      console.error('[enviar-form] Erro ao atualizar status:', updateError);
      throw new Error('Erro ao atualizar status do registro');
    }

    console.log('[enviar-form] ✅ Registro enviado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Ação social enviada ao formulário oficial com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[enviar-form] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
