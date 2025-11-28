import { corsHeaders } from '../_shared/cors.ts';

interface CleanupOptions {
  dryRun?: boolean;           // Se true, só lista sem deletar
  olderThanHours?: number;    // Deletar arquivos criados há mais de X horas
  nameContains?: string;      // Filtrar arquivos por nome
}

interface FileInfo {
  id: string;
  name: string;
  createdTime: string;
  deleted: boolean;
  error?: string;
}

interface CleanupResult {
  success: boolean;
  filesFound: number;
  filesDeleted: number;
  errors: string[];
  details: FileInfo[];
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
  const scopes = ['https://www.googleapis.com/auth/drive'];

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

// Lista arquivos do Drive da Service Account
async function listDriveFiles(
  accessToken: string,
  nameContains: string
): Promise<FileInfo[]> {
  const query = `name contains '${nameContains}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime desc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[List Files Error]', errorText);
    throw new Error('Falha ao listar arquivos no Drive');
  }

  const data = await response.json();
  return (data.files || []).map((file: any) => ({
    id: file.id,
    name: file.name,
    createdTime: file.createdTime,
    deleted: false
  }));
}

// Deleta um arquivo do Drive
async function deleteFile(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    return response.ok || response.status === 404;
  } catch (error) {
    console.error(`[Delete File Error] ${fileId}:`, error);
    return false;
  }
}

// Função principal de limpeza
async function cleanupDriveFiles(
  accessToken: string,
  options: CleanupOptions
): Promise<CleanupResult> {
  const {
    dryRun = false,
    olderThanHours = 1,
    nameContains = 'Relatório CMD'
  } = options;

  console.log('[Cleanup] Iniciando limpeza com opções:', { dryRun, olderThanHours, nameContains });

  // Listar arquivos
  const files = await listDriveFiles(accessToken, nameContains);
  console.log(`[Cleanup] Encontrados ${files.length} arquivos no total`);

  // Filtrar por idade
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const filesToDelete = files.filter(file => 
    new Date(file.createdTime) < cutoffTime
  );

  console.log(`[Cleanup] ${filesToDelete.length} arquivos serão processados (criados antes de ${cutoffTime.toISOString()})`);

  const result: CleanupResult = {
    success: true,
    filesFound: files.length,
    filesDeleted: 0,
    errors: [],
    details: []
  };

  // Processar arquivos
  for (const file of filesToDelete) {
    if (dryRun) {
      console.log(`[Cleanup] [DRY RUN] Seria deletado: ${file.name} (${file.id})`);
      result.details.push({ ...file, deleted: false });
    } else {
      console.log(`[Cleanup] Deletando: ${file.name} (${file.id})`);
      const success = await deleteFile(accessToken, file.id);
      
      if (success) {
        result.filesDeleted++;
        result.details.push({ ...file, deleted: true });
      } else {
        result.errors.push(`Falha ao deletar ${file.name} (${file.id})`);
        result.details.push({ ...file, deleted: false, error: 'Falha na deleção' });
      }
    }
  }

  result.success = result.errors.length === 0;
  console.log('[Cleanup] Resultado final:', {
    filesFound: result.filesFound,
    filesDeleted: result.filesDeleted,
    errors: result.errors.length
  });

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse opções (ou usar defaults)
    const body = await req.text();
    const options: CleanupOptions = body ? JSON.parse(body) : {};

    console.log('[Cleanup Drive] Requisição recebida:', options);

    // Obter secrets
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    if (!serviceAccountEmail || !privateKey) {
      console.error('[Cleanup Drive] Secrets não configurados');
      return new Response(
        JSON.stringify({ error: 'Configuração Google incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autenticar
    console.log('[Cleanup Drive] Autenticando com Google...');
    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);

    // Executar limpeza
    const result = await cleanupDriveFiles(accessToken, options);

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Cleanup Drive] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao executar limpeza'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
