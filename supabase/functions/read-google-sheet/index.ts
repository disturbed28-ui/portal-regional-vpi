import { corsHeaders } from '../_shared/cors.ts';

interface ReadSheetParams {
  spreadsheetId: string;
  range?: string;
  sheetName?: string;
  includeHeaders?: boolean;
}

interface SheetResult {
  success: boolean;
  spreadsheetTitle?: string;
  sheetTitle?: string;
  rowCount?: number;
  columnCount?: number;
  data?: Record<string, string>[] | string[][];
  error?: string;
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

// Obtém access token do Google com scope de Sheets
async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

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

// Lê dados de uma planilha
async function readSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  range?: string
): Promise<{
  spreadsheetTitle: string;
  sheetTitle: string;
  values: string[][];
}> {
  // Primeiro, obter metadados da planilha
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
  
  console.log('[read-google-sheet] Buscando metadados da planilha...');
  const metaResponse = await fetch(metaUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!metaResponse.ok) {
    const errorText = await metaResponse.text();
    console.error('[read-google-sheet] Erro ao buscar metadados:', errorText);
    throw new Error(`Erro ao acessar planilha: ${metaResponse.status}`);
  }

  const metadata = await metaResponse.json();
  const spreadsheetTitle = metadata.properties?.title || 'Sem título';
  const firstSheet = metadata.sheets?.[0]?.properties;
  const sheetTitle = firstSheet?.title || 'Sheet1';

  console.log('[read-google-sheet] Planilha:', spreadsheetTitle, '| Aba:', sheetTitle);

  // Agora buscar os dados
  const dataRange = range || `${sheetTitle}!A:ZZ`;
  const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(dataRange)}`;

  console.log('[read-google-sheet] Buscando dados do range:', dataRange);
  const dataResponse = await fetch(dataUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!dataResponse.ok) {
    const errorText = await dataResponse.text();
    console.error('[read-google-sheet] Erro ao buscar dados:', errorText);
    throw new Error(`Erro ao ler dados da planilha: ${dataResponse.status}`);
  }

  const sheetData = await dataResponse.json();
  const values = sheetData.values || [];

  console.log('[read-google-sheet] Linhas encontradas:', values.length);

  return {
    spreadsheetTitle,
    sheetTitle,
    values
  };
}

// Converte array de arrays para objetos usando primeira linha como headers
function convertToObjects(data: string[][]): Record<string, string>[] {
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as ReadSheetParams;
    const { spreadsheetId, range, sheetName, includeHeaders = true } = body;

    console.log('[read-google-sheet] Requisição recebida:', { spreadsheetId, range, sheetName, includeHeaders });

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'spreadsheetId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter secrets
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    if (!serviceAccountEmail || !privateKey) {
      console.error('[read-google-sheet] Secrets não configurados');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração Google incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autenticar
    console.log('[read-google-sheet] Autenticando com Google...');
    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);

    // Construir range
    let effectiveRange = range;
    if (sheetName && !range) {
      effectiveRange = `${sheetName}!A:ZZ`;
    } else if (sheetName && range && !range.includes('!')) {
      effectiveRange = `${sheetName}!${range}`;
    }

    // Ler planilha
    const { spreadsheetTitle, sheetTitle, values } = await readSpreadsheet(
      accessToken,
      spreadsheetId,
      effectiveRange
    );

    // Preparar resultado
    const result: SheetResult = {
      success: true,
      spreadsheetTitle,
      sheetTitle,
      rowCount: values.length,
      columnCount: values[0]?.length || 0
    };

    if (includeHeaders && values.length > 0) {
      result.data = convertToObjects(values);
      result.rowCount = (result.data as Record<string, string>[]).length;
    } else {
      result.data = values;
    }

    console.log('[read-google-sheet] Sucesso! Linhas retornadas:', result.rowCount);

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[read-google-sheet] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao ler planilha'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
