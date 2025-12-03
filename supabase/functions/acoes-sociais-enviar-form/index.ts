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
      throw new Error('Nao autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[enviar-form] Erro de autenticacao:', authError);
      throw new Error('Nao autenticado');
    }

    const { registro_id } = await req.json() as EnviarFormPayload;

    if (!registro_id) {
      throw new Error('registro_id e obrigatorio');
    }

    console.log(`[enviar-form] Processando registro ${registro_id} para usuario ${user.id}`);

    // Buscar registro
    const { data: registro, error: registroError } = await supabase
      .from('acoes_sociais_registros')
      .select('*')
      .eq('id', registro_id)
      .single();

    if (registroError || !registro) {
      console.error('[enviar-form] Erro ao buscar registro:', registroError);
      throw new Error('Registro nao encontrado');
    }

    // Verificar ownership
    if (registro.profile_id !== user.id) {
      throw new Error('Voce nao tem permissao para enviar este registro');
    }

    // Verificar se ja foi enviado
    if (registro.google_form_status === 'enviado') {
      throw new Error('Este registro ja foi enviado ao formulario');
    }

    // Buscar todas as configuracoes ativas
    const { data: configs, error: configError } = await supabase
      .from('acoes_sociais_config_regional')
      .select('email_formulario, regional_texto')
      .eq('ativo', true);

    if (configError) {
      console.error('[enviar-form] Erro ao buscar configs:', configError);
      throw new Error('Erro ao buscar configuracoes de email');
    }

    // Funcao para normalizar texto de regional (para match interno)
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

    // Funcao para converter regional do banco para formato Google Forms
    const normalizeRegionalForGoogleForms = (regional: string): string => {
      // Mapeamento direto para valores conhecidos
      const mapeamento: Record<string, string> = {
        'REGIONAL VALE DO PARAIBA I - SP': 'Vale do Paraíba 1',
        'REGIONAL VALE DO PARAIBA II - SP': 'Vale do Paraíba 2',
        'REGIONAL LITORAL NORTE - SP': 'Litoral Norte - SP',
        // Futuramente:
        // 'REGIONAL VALE DO PARAIBA III - SP': 'Vale do Paraíba 3',
      };
      
      // Tenta mapeamento direto primeiro
      const upperRegional = regional.toUpperCase().trim();
      if (mapeamento[upperRegional]) {
        return mapeamento[upperRegional];
      }
      
      // Fallback: normalizacao generica para outras regionais
      let normalized = regional
        .replace(/^REGIONAL\s+/i, '')
        .replace(/\s+-\s+SP$/i, '')
        .trim();
      
      // Converte algarismos romanos para numeros
      const romanMap: Record<string, string> = {
        ' I': ' 1', ' II': ' 2', ' III': ' 3', ' IV': ' 4', ' V': ' 5'
      };
      
      for (const [roman, num] of Object.entries(romanMap)) {
        if (normalized.toUpperCase().endsWith(roman)) {
          normalized = normalized.slice(0, -roman.length) + num;
          break;
        }
      }
      
      // Normaliza para title case com acentos corretos
      return normalized
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bDo\b/g, 'do')
        .replace(/Paraiba/gi, 'Paraíba');
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
      throw new Error(`Configuracao de email nao encontrada para a regional: ${registro.regional_relatorio_texto}`);
    }

    console.log('[enviar-form] Config encontrada:', {
      registroRegional: registro.regional_relatorio_texto,
      configRegional: config.regional_texto,
      email: config.email_formulario
    });

    // Extrair ano, mes e dia da data_acao
    const dataAcao = new Date(registro.data_acao);
    const ano = dataAcao.getFullYear();
    const mes = dataAcao.getMonth() + 1; // Janeiro = 1
    const dia = dataAcao.getDate();

    // Mapear escopo_acao para texto exato do formulario Google
    const mapearEscopo = (escopo: string): string => {
      const mapeamento: Record<string, string> = {
        'interna': 'Interna ( ajuda ao integrante)',
        'externa': 'Externa',
      };
      return mapeamento[escopo?.toLowerCase()] || escopo || '';
    };

    const escopoFormulario = mapearEscopo(registro.escopo_acao);

    // Normalizar regional para formato Google Forms
    const regionalNormalizada = normalizeRegionalForGoogleForms(registro.regional_relatorio_texto || '');
    
    console.log('[enviar-form] Regional normalizada:', {
      original: registro.regional_relatorio_texto,
      normalizada: regionalNormalizada
    });

    // Montar payload para Google Forms (com mapeamento correto)
    const formData = new URLSearchParams({
      'emailAddress': config.email_formulario,
      'entry.1698025551_year': ano.toString(),
      'entry.1698025551_month': mes.toString(),
      'entry.1698025551_day': dia.toString(),
      'entry.1818867636': regionalNormalizada,                        // Regional (normalizada)
      'entry.354405432': registro.divisao_relatorio_texto || '',      // Divisao
      'entry.577779066': registro.responsavel_nome_colete || '',      // Responsavel
      'entry.122607591': registro.descricao_acao || '',               // Descricao
      'entry.1873990495': escopoFormulario,                           // Escopo (mapeado)
      'entry.2045537139': registro.tipo_acao_nome_snapshot || '',     // Tipo de Acao (ja corrigido no banco)
    });

    console.log('[enviar-form] Enviando para Google Forms...', {
      dadosEnviados: Object.fromEntries(formData)
    });

    // Enviar para Google Forms COM validacao de resposta HTTP
    // REMOVIDO mode: 'no-cors' - Edge Function (Deno) pode fazer cross-origin requests
    // e precisamos validar o status HTTP da resposta
    try {
      const response = await fetch(
        'https://docs.google.com/forms/d/e/1FAIpQLScgIgriBBDQpzI5h3JdHia6-RL2zz8kl3pWNsZA9P8kkob2UA/formResponse',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      console.log('[enviar-form] Google Forms response:', {
        status: response.status,
        statusText: response.statusText,
      });

      // Validar status HTTP - sucesso apenas se 2xx ou 3xx
      if (response.status < 200 || response.status >= 400) {
        console.error('[enviar-form] Google Forms retornou status invalido:', {
          status: response.status,
          statusText: response.statusText,
        });

        // Marcar como erro no banco
        const { error: updateErrorStatus } = await supabase
          .from('acoes_sociais_registros')
          .update({ google_form_status: 'erro' })
          .eq('id', registro_id);

        if (updateErrorStatus) {
          console.error('[enviar-form] Falha ao atualizar status para erro:', updateErrorStatus);
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: `Google Forms retornou erro (HTTP ${response.status})`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      // Sucesso confirmado via status HTTP
      console.log('[enviar-form] Google Forms aceitou a requisicao (HTTP ' + response.status + ')');

    } catch (networkError) {
      // Erro de rede real (DNS, timeout, conexao recusada, etc)
      console.error('[enviar-form] Erro de rede ao enviar ao Google Forms:', networkError);
      
      // Marcar como erro no banco
      const { error: updateNetworkError } = await supabase
        .from('acoes_sociais_registros')
        .update({ google_form_status: 'erro' })
        .eq('id', registro_id);

      if (updateNetworkError) {
        console.error('[enviar-form] Falha ao atualizar status para erro:', updateNetworkError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Falha na conexao com Google Forms',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // SOMENTE APOS validacao de sucesso (status 2xx/3xx), atualizar como enviado
    const { error: updateError } = await supabase
      .from('acoes_sociais_registros')
      .update({
        google_form_status: 'enviado',
        google_form_enviado_em: new Date().toISOString(),
        google_form_enviado_por: user.id,
      })
      .eq('id', registro_id);

    if (updateError) {
      console.error('[enviar-form] Erro ao atualizar status para enviado:', updateError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Registro enviado ao Google Forms, mas falhou ao atualizar status no banco',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('[enviar-form] Registro marcado como enviado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Acao social enviada ao formulario oficial com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[enviar-form] Erro:', error);
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
