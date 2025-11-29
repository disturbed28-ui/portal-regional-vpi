import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Last updated: 2025-01-28T23:30:00Z - Added detailed clone error handling
// Interfaces
interface DadosMovimentacaoDivisao {
  divisao_nome: string;
  entradas: number;
  saidas: number;
  total_semana_anterior: number;
  total_semana_atual: number;
  percentual_crescimento: number;
}

interface DadosMovimentacao {
  regional_nome: string;
  divisoes: DadosMovimentacaoDivisao[];
  totais: {
    entradas: number;
    saidas: number;
    total_semana_anterior: number;
    total_semana_atual: number;
    percentual_crescimento: number;
  };
}

// Normaliza nome de divisão para matching
function normalizeDivisaoNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gera JWT para autenticação Google Service Account
async function generateGoogleJWT(
  email: string, 
  privateKey: string, 
  scopes: string[]
): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Importar chave privada
  const pemKey = privateKey.replace(/\\n/g, '\n');
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pemKey.substring(
    pemKey.indexOf(pemHeader) + pemHeader.length,
    pemKey.indexOf(pemFooter)
  ).replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  // Assinar
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${encodedSignature}`;
}

// Obtém access token do Google
async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ];

  const jwt = await generateGoogleJWT(email, privateKey, scopes);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Google OAuth Error]', errorText);
    throw new Error('Falha na autenticação Google');
  }

  const data = await response.json();
  return data.access_token;
}

// Interface para erro de clone
interface CloneTemplateError extends Error {
  reason?: string;
  googleResponse?: any;
}

// Clona o template do Google Sheets
async function cloneTemplate(
  accessToken: string, 
  templateId: string, 
  newTitle: string
): Promise<string> {
  console.log('[export-relatorio-cmd] copying template', { templateId, newTitle });
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newTitle })
    }
  );

  if (!response.ok) {
    let googleResponse: any = null;
    let reason: string | undefined;
    let message: string = `HTTP ${response.status}`;
    
    try {
      const responseText = await response.text();
      googleResponse = JSON.parse(responseText);
      
      const googleError = googleResponse?.error;
      const googleErrors = googleError?.errors as { reason?: string; message?: string }[] | undefined;
      
      reason = googleErrors?.[0]?.reason;
      message = googleErrors?.[0]?.message ?? googleError?.message ?? responseText;
    } catch (parseErr) {
      message = await response.text().catch(() => `HTTP ${response.status}`);
    }
    
    console.error('[export-relatorio-cmd] clone template error', {
      reason,
      message,
      googleResponse,
    });
    
    const error = new Error(message) as CloneTemplateError;
    error.name = 'clone_template_failed';
    error.reason = reason;
    error.googleResponse = googleResponse;
    throw error;
  }

  const data = await response.json();
  console.log('[export-relatorio-cmd] template cloned', { clonedId: data.id });
  return data.id;
}

// Exporta planilha como XLSX via Google Drive API
async function exportAsXlsx(accessToken: string, spreadsheetId: string): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Export XLSX Error]', errorText);
    throw new Error('Falha ao exportar XLSX');
  }

  return await response.arrayBuffer();
}

// Deleta arquivo temporário do Google Drive
async function deleteFile(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (response.ok || response.status === 404) {
      console.log(`[Delete File] ✅ Arquivo ${fileId} deletado com sucesso`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[Delete File] ❌ Falha ao deletar ${fileId}: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`[Delete File] ❌ Erro ao deletar ${fileId}:`, error);
    return false;
  }
}

// Tenta deletar arquivo com retry
async function deleteFileWithRetry(
  accessToken: string, 
  fileId: string, 
  maxRetries: number = 1
): Promise<void> {
  console.log(`[Delete Retry] 🗑️ Tentando deletar ${fileId}...`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const success = await deleteFile(accessToken, fileId);
    if (success) {
      return;
    }
    
    if (attempt < maxRetries) {
      console.log(`[Delete Retry] ⏳ Tentativa ${attempt + 1} falhou, aguardando 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`[Delete Retry] ⚠️ Falha ao deletar ${fileId} após ${maxRetries + 1} tentativas`);
}

// Busca dados de movimentação via Supabase
async function fetchDadosMovimentacao(
  regional_id: string,
  ano: number,
  mes: number,
  semana: number
): Promise<DadosMovimentacao> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Fetch Dados] Iniciando busca para:', { regional_id, ano, mes, semana });

  // 1. Buscar regional e suas divisões
  const { data: regionalData, error: regionalError } = await supabase
    .from('regionais')
    .select('nome')
    .eq('id', regional_id)
    .single();

  if (regionalError) throw new Error(`Erro ao buscar regional: ${regionalError.message}`);

  const { data: divisoesData, error: divisoesError } = await supabase
    .from('divisoes')
    .select('id, nome')
    .eq('regional_id', regional_id)
    .order('nome');

  if (divisoesError) throw new Error(`Erro ao buscar divisões: ${divisoesError.message}`);
  console.log('[Fetch Dados] Divisões encontradas:', divisoesData?.length);

  // 2. Buscar relatórios semanais (entradas/saídas)
  const { data: relatoriosData, error: relatoriosError } = await supabase
    .from('relatorios_semanais_divisao')
    .select('divisao_relatorio_id, divisao_relatorio_texto, entradas_json, saidas_json')
    .eq('regional_relatorio_id', regional_id)
    .eq('ano_referencia', ano)
    .eq('mes_referencia', mes)
    .eq('semana_no_mes', semana);

  if (relatoriosError) console.warn('[Fetch Dados] Erro ao buscar relatórios:', relatoriosError.message);
  console.log('[Fetch Dados] Relatórios semanais encontrados:', relatoriosData?.length || 0);

  // 3. Buscar última carga do mês anterior
  const primeiroDiaMesAtual = new Date(ano, mes - 1, 1);
  const primeiroDiaMesAnterior = new Date(ano, mes - 2, 1);
  
  const { data: cargaAnterior, error: cargaAnteriorError } = await supabase
    .from('cargas_historico')
    .select('dados_snapshot, data_carga')
    .eq('tipo_carga', 'integrantes')
    .gte('data_carga', primeiroDiaMesAnterior.toISOString())
    .lt('data_carga', primeiroDiaMesAtual.toISOString())
    .order('data_carga', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cargaAnteriorError) console.warn('[Fetch Dados] Erro ao buscar carga anterior:', cargaAnteriorError.message);
  console.log('[Fetch Dados] Carga mês anterior:', cargaAnterior?.data_carga || 'Não encontrada');

  // 4. Buscar última carga do mês atual
  const ultimoDiaMesAtual = new Date(ano, mes, 0);
  
  const { data: cargaAtual, error: cargaAtualError } = await supabase
    .from('cargas_historico')
    .select('dados_snapshot, data_carga')
    .eq('tipo_carga', 'integrantes')
    .gte('data_carga', primeiroDiaMesAtual.toISOString())
    .lte('data_carga', ultimoDiaMesAtual.toISOString())
    .order('data_carga', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cargaAtualError) console.warn('[Fetch Dados] Erro ao buscar carga atual:', cargaAtualError.message);
  console.log('[Fetch Dados] Carga mês atual:', cargaAtual?.data_carga || 'Não encontrada');

  // 5. Processar dados por divisão
  const divisoes: DadosMovimentacaoDivisao[] = [];
  let totais = {
    entradas: 0,
    saidas: 0,
    total_semana_anterior: 0,
    total_semana_atual: 0,
    percentual_crescimento: 0
  };

  for (const divisao of divisoesData || []) {
    const divisaoNormalizada = normalizeDivisaoNome(divisao.nome);

    // Buscar relatório semanal
    const relatorio = relatoriosData?.find(r => 
      r.divisao_relatorio_id === divisao.id ||
      normalizeDivisaoNome(r.divisao_relatorio_texto) === divisaoNormalizada
    );

    const entradas = relatorio?.entradas_json 
      ? (Array.isArray(relatorio.entradas_json) ? relatorio.entradas_json.length : 0)
      : 0;
    
    const saidas = relatorio?.saidas_json 
      ? (Array.isArray(relatorio.saidas_json) ? relatorio.saidas_json.length : 0)
      : 0;

    // Buscar total da semana anterior no snapshot
    let total_semana_anterior = 0;
    if (cargaAnterior?.dados_snapshot) {
      const snapshot = cargaAnterior.dados_snapshot as any;
      const divSnapshot = snapshot.divisoes?.find((d: any) => 
        normalizeDivisaoNome(d.divisao) === divisaoNormalizada
      );
      total_semana_anterior = divSnapshot?.total || 0;
    }

    // Buscar total da semana atual no snapshot
    let total_semana_atual = 0;
    if (cargaAtual?.dados_snapshot) {
      const snapshot = cargaAtual.dados_snapshot as any;
      const divSnapshot = snapshot.divisoes?.find((d: any) => 
        normalizeDivisaoNome(d.divisao) === divisaoNormalizada
      );
      total_semana_atual = divSnapshot?.total || 0;
    }

    // Calcular % de crescimento
    const percentual_crescimento = total_semana_anterior > 0
      ? ((total_semana_atual - total_semana_anterior) / total_semana_anterior) * 100
      : 0;

    divisoes.push({
      divisao_nome: divisao.nome,
      entradas,
      saidas,
      total_semana_anterior,
      total_semana_atual,
      percentual_crescimento
    });

    // Acumular totais
    totais.entradas += entradas;
    totais.saidas += saidas;
    totais.total_semana_anterior += total_semana_anterior;
    totais.total_semana_atual += total_semana_atual;
  }

  // Calcular % de crescimento total
  totais.percentual_crescimento = totais.total_semana_anterior > 0
    ? ((totais.total_semana_atual - totais.total_semana_anterior) / totais.total_semana_anterior) * 100
    : 0;

  console.log('[Fetch Dados] Processamento concluído:', {
    divisoes: divisoes.length,
    totais
  });

  return {
    regional_nome: regionalData.nome,
    divisoes,
    totais
  };
}

// Preenche o bloco de movimentação no Google Sheets
async function preencherBlocoMovimentacao(
  accessToken: string,
  spreadsheetId: string,
  dados: DadosMovimentacao
): Promise<void> {
  const PRIMEIRA_LINHA = 10; // Linha inicial de dados (ajustar conforme template)
  const values: any[][] = [];

  console.log('[Preencher Bloco] Iniciando preenchimento para:', dados.regional_nome);

  // Preencher uma linha por divisão
  dados.divisoes.forEach((div) => {
    const row = new Array(16).fill('');
    row[3] = div.divisao_nome;                    // Coluna D
    row[5] = div.entradas;                        // Coluna F
    row[6] = div.saidas;                          // Coluna G
    row[10] = div.total_semana_anterior;          // Coluna K
    row[13] = div.total_semana_atual;             // Coluna N
    row[15] = div.percentual_crescimento / 100;   // Coluna P (formato decimal)
    values.push(row);
  });

  // Linha de totais
  const totaisRow = new Array(16).fill('');
  totaisRow[3] = 'TOTAL';
  totaisRow[5] = dados.totais.entradas;
  totaisRow[6] = dados.totais.saidas;
  totaisRow[10] = dados.totais.total_semana_anterior;
  totaisRow[13] = dados.totais.total_semana_atual;
  totaisRow[15] = dados.totais.percentual_crescimento / 100;
  values.push(totaisRow);

  console.log('[Preencher Bloco] Linhas a preencher:', values.length);

  // Usar Google Sheets API para preencher
  const range = `Sheet1!A${PRIMEIRA_LINHA}:P${PRIMEIRA_LINHA + values.length - 1}`;
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Preencher Bloco] Erro ao preencher:', errorText);
    throw new Error('Falha ao preencher dados no Google Sheets');
  }

  console.log('[Preencher Bloco] Preenchimento concluído com sucesso');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let accessToken: string | null = null;
  let newSpreadsheetId: string | null = null;

  try {
    const { regional_id, ano, mes, semana } = await req.json();

    console.log('[Export CMD] Parâmetros:', { regional_id, ano, mes, semana });

    // Validar parâmetros
    if (!regional_id || !ano || !mes || !semana) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: regional_id, ano, mes, semana' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter secrets
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    const templateId = Deno.env.get('GOOGLE_SHEETS_TEMPLATE_ID');

    if (!serviceAccountEmail || !privateKey || !templateId) {
      console.error('[Export CMD] Secrets não configurados');
      return new Response(
        JSON.stringify({ error: 'Configuração Google incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Export CMD] Autenticando com Google...');
    accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);

    console.log('[Export CMD] Clonando template...');
    const newTitle = `Relatório CMD - Ano ${ano} - Mês ${mes} - Semana ${semana}`;
    newSpreadsheetId = await cloneTemplate(accessToken, templateId, newTitle);

    console.log('[Export CMD] Novo spreadsheet criado:', newSpreadsheetId);

    // Buscar dados de movimentação
    console.log('[Export CMD] Buscando dados de movimentação...');
    const dadosMovimentacao = await fetchDadosMovimentacao(regional_id, ano, mes, semana);

    // Preencher bloco de movimentação
    console.log('[Export CMD] Preenchendo bloco de movimentação...');
    await preencherBlocoMovimentacao(accessToken, newSpreadsheetId, dadosMovimentacao);

    console.log('[Export CMD] Exportando como XLSX...');
    const xlsxBuffer = await exportAsXlsx(accessToken, newSpreadsheetId);

    console.log('[Export CMD] Sucesso!');

    return new Response(xlsxBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Relatorio_CMD_${ano}_${mes}_Sem${semana}.xlsx"`
      }
    });

  } catch (error) {
    const anyErr = error as any;
    
    // Tratamento específico para erro de clone do template
    if (anyErr.name === 'clone_template_failed' || anyErr?.reason) {
      console.error('[export-relatorio-cmd] clone template error caught in handler', {
        reason: anyErr.reason,
        message: anyErr.message,
        google: anyErr.googleResponse
      });
      
      return new Response(
        JSON.stringify({
          error: 'clone_template_failed',
          reason: anyErr.reason || null,
          message: anyErr.message || 'Unknown clone error',
          google: anyErr.googleResponse || null,
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Tratamento genérico para outros erros
    console.error('[Export CMD] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao gerar relatório'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } finally {
    // GARANTIR deleção do arquivo temporário SEMPRE
    if (newSpreadsheetId && accessToken) {
      console.log('[Export CMD] 🧹 Limpando arquivo temporário no finally...');
      await deleteFileWithRetry(accessToken, newSpreadsheetId);
    }
  }
});
