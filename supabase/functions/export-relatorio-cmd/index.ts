import { corsHeaders } from '../_shared/cors.ts';

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
    'https://www.googleapis.com/auth/drive.file'
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

// Clona o template do Google Sheets
async function cloneTemplate(
  accessToken: string, 
  templateId: string, 
  newTitle: string
): Promise<string> {
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
    const errorText = await response.text();
    console.error('[Clone Template Error]', errorText);
    throw new Error('Falha ao clonar template');
  }

  const data = await response.json();
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
async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);

    console.log('[Export CMD] Clonando template...');
    const newTitle = `Relatório CMD - Ano ${ano} - Mês ${mes} - Semana ${semana}`;
    const newSpreadsheetId = await cloneTemplate(accessToken, templateId, newTitle);

    console.log('[Export CMD] Novo spreadsheet criado:', newSpreadsheetId);

    // TODO: Futuramente, aqui será adicionada a lógica de preenchimento de dados
    // usando a API do Google Sheets (batchUpdate)

    console.log('[Export CMD] Exportando como XLSX...');
    const xlsxBuffer = await exportAsXlsx(accessToken, newSpreadsheetId);

    console.log('[Export CMD] Deletando arquivo temporário...');
    await deleteFile(accessToken, newSpreadsheetId);

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
  }
});
