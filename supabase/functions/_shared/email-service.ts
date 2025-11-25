import { Resend } from 'https://esm.sh/resend@4.0.0';

interface EmailConfig {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface AlertData {
  nome_colete: string;
  divisao_texto: string;
  dias_atraso: number;
  valor_total: number;
  total_parcelas: number;
  destinatario_nome: string;
  destinatario_cargo: string;
  tipo_alerta: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY não configurada nas variáveis de ambiente');
    }
    console.log('[email-service] Inicializando cliente Resend...');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendEmail(config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resend = getResendClient();
    
    console.log('[email-service] 📧 Enviando email via Resend para:', config.to);
    console.log('[email-service] CC:', config.cc || 'Nenhum');
    
    const { data, error } = await resend.emails.send({
      from: 'Portal Regional VP1 <noreply@vp1.app.br>',
      to: Array.isArray(config.to) ? config.to : [config.to],
      cc: config.cc ? (Array.isArray(config.cc) ? config.cc : [config.cc]) : undefined,
      subject: config.subject,
      html: config.html,
      text: config.text || config.subject,
    });

    if (error) {
      console.error('[email-service] ❌ Erro do Resend:', error);
      throw error;
    }

    console.log('[email-service] ✅ Email enviado com sucesso! ID:', data?.id);
    return { success: true, messageId: data?.id };
    
  } catch (error) {
    console.error('[email-service] ❌ Erro ao enviar email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar email' 
    };
  }
}

export function renderAlertTemplate(data: AlertData, templateVersion: string = 'v1'): { html: string; text: string } {
  const portalUrl = 'https://48ecd9cb-adf8-4eee-8548-c826c493e103.lovableproject.com/relatorios';
  
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alerta de Inadimplência</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6; 
          color: #1f2937;
          background-color: #f3f4f6;
          padding: 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white; 
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.95;
        }
        .content { 
          padding: 32px 24px;
        }
        .alert-badge {
          display: inline-block;
          background: #fef2f2;
          color: #dc2626;
          padding: 8px 16px;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
        }
        .intro {
          font-size: 15px;
          color: #4b5563;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        .data-box { 
          background: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          margin: 24px 0;
          border-left: 4px solid #dc2626;
        }
        .data-box h2 {
          font-size: 18px;
          color: #111827;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .data-row { 
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-row:last-child {
          border-bottom: none;
        }
        .label { 
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        .value { 
          color: #6b7280;
          font-size: 14px;
          text-align: right;
        }
        .value.highlight {
          color: #dc2626;
          font-weight: 700;
          font-size: 16px;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button { 
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          transition: background 0.2s;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }
        .button:hover {
          background: #b91c1c;
        }
        .info-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
        }
        .info-box p {
          font-size: 13px;
          color: #1e40af;
          line-height: 1.6;
        }
        .footer { 
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 8px 0;
        }
        @media only screen and (max-width: 600px) {
          .container { margin: 0; border-radius: 0; }
          .content { padding: 24px 16px; }
          .data-row { flex-direction: column; }
          .value { text-align: left; margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Alerta de Inadimplência</h1>
          <p>Portal Regional Vale do Paraíba I - SP</p>
        </div>
        
        <div class="content">
          <div class="alert-badge">
            📋 ${data.tipo_alerta.replace(/_/g, ' ')}
          </div>
          
          <p class="intro">
            Prezado(a) <strong>${data.destinatario_nome}</strong> (${data.destinatario_cargo}),
          </p>
          
          <p class="intro">
            Identificamos pendências financeiras que requerem sua atenção imediata. 
            Um integrante da sua divisão está com mensalidades em atraso há mais de 70 dias.
          </p>
          
          <div class="data-box">
            <h2>📊 Detalhes da Inadimplência</h2>
            <div class="data-row">
              <span class="label">Integrante:</span>
              <span class="value"><strong>${data.nome_colete}</strong></span>
            </div>
            <div class="data-row">
              <span class="label">Divisão:</span>
              <span class="value">${data.divisao_texto}</span>
            </div>
            <div class="data-row">
              <span class="label">Dias em Atraso:</span>
              <span class="value highlight">${data.dias_atraso} dias</span>
            </div>
            <div class="data-row">
              <span class="label">Valor Total Devido:</span>
              <span class="value highlight">R$ ${data.valor_total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="data-row">
              <span class="label">Total de Parcelas:</span>
              <span class="value">${data.total_parcelas} parcela${data.total_parcelas > 1 ? 's' : ''}</span>
            </div>
          </div>
          
          <div class="info-box">
            <p>
              <strong>💡 Ação Requerida:</strong><br>
              Por favor, entre em contato com o integrante para regularização da situação. 
              O não pagamento pode resultar em medidas administrativas conforme regulamento interno.
            </p>
          </div>
          
          <div class="button-container">
            <a href="${portalUrl}" class="button">
              📈 Ver Relatório Completo no Portal →
            </a>
          </div>
          
          <div class="footer">
            <p><strong>Portal Regional Vale do Paraíba I - SP</strong></p>
            <p>Esta é uma notificação automática do sistema de gestão.</p>
            <p style="margin-top: 16px; font-size: 11px; color: #d1d5db;">
              Template ${templateVersion} | ${new Date().toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
ALERTA DE INADIMPLÊNCIA
Portal Regional Vale do Paraíba I - SP

Prezado(a) ${data.destinatario_nome} (${data.destinatario_cargo}),

Identificamos pendências financeiras que requerem sua atenção imediata.

DETALHES DA INADIMPLÊNCIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Integrante: ${data.nome_colete}
Divisão: ${data.divisao_texto}
Dias em Atraso: ${data.dias_atraso} dias
Valor Total Devido: R$ ${data.valor_total.toFixed(2).replace('.', ',')}
Total de Parcelas: ${data.total_parcelas}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AÇÃO REQUERIDA:
Por favor, entre em contato com o integrante para regularização da situação.

Acesse o portal para ver o relatório completo:
${portalUrl}

────────────────────────────────────
Portal Regional Vale do Paraíba I - SP
Esta é uma notificação automática do sistema de gestão.
Template ${templateVersion} | ${new Date().toLocaleDateString('pt-BR')}
  `.trim();

  return { html, text };
}

export function renderNewProfileTemplate(profileData: {
  name: string;
  nome_colete: string;
  telefone: string;
  profile_status: string;
  updated_at: string;
}): { html: string; text: string } {
  const portalUrl = 'https://48ecd9cb-adf8-4eee-8548-c826c493e103.lovableproject.com/admin';
  const dataFormatada = new Date(profileData.updated_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Novo Cadastro Pendente</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6; 
          color: #1f2937;
          background-color: #f3f4f6;
          padding: 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white; 
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.95;
        }
        .content { 
          padding: 32px 24px;
        }
        .intro {
          font-size: 15px;
          color: #4b5563;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        .data-box { 
          background: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          margin: 24px 0;
          border-left: 4px solid #dc2626;
        }
        .data-box h2 {
          font-size: 18px;
          color: #111827;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .data-row { 
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-row:last-child {
          border-bottom: none;
        }
        .label { 
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        .value { 
          color: #6b7280;
          font-size: 14px;
          text-align: right;
        }
        .value.highlight {
          color: #dc2626;
          font-weight: 700;
          font-size: 16px;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button { 
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          transition: background 0.2s;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }
        .button:hover {
          background: #b91c1c;
        }
        .footer { 
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 8px 0;
        }
        @media only screen and (max-width: 600px) {
          .container { margin: 0; border-radius: 0; }
          .content { padding: 24px 16px; }
          .data-row { flex-direction: column; }
          .value { text-align: left; margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🆕 Novo Cadastro Recebido</h1>
          <p>Portal Regional Vale do Paraíba I - SP</p>
        </div>
        
        <div class="content">
          <p class="intro">
            Um novo usuário completou seu cadastro no Portal Regional e está aguardando aprovação.
          </p>
          
          <div class="data-box">
            <h2>📊 Dados do Integrante</h2>
            <div class="data-row">
              <span class="label">Nome:</span>
              <span class="value">${profileData.name}</span>
            </div>
            <div class="data-row">
              <span class="label">Nome de Colete:</span>
              <span class="value"><strong>${profileData.nome_colete}</strong></span>
            </div>
            <div class="data-row">
              <span class="label">Telefone:</span>
              <span class="value">${profileData.telefone || 'Não informado'}</span>
            </div>
            <div class="data-row">
              <span class="label">Status:</span>
              <span class="value highlight">${profileData.profile_status}</span>
            </div>
            <div class="data-row">
              <span class="label">Data de Cadastro:</span>
              <span class="value">${dataFormatada}</span>
            </div>
          </div>
          
          <div class="button-container">
            <a href="${portalUrl}" class="button">
              🔐 Acessar Portal de Administração →
            </a>
          </div>
          
          <div class="footer">
            <p><strong>Portal Regional Vale do Paraíba I - SP</strong></p>
            <p>Esta é uma notificação automática do sistema de gestão.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
NOVO CADASTRO RECEBIDO
Portal Regional Vale do Paraíba I - SP

Um novo usuário completou seu cadastro e está aguardando aprovação.

DADOS DO INTEGRANTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nome: ${profileData.name}
Nome de Colete: ${profileData.nome_colete}
Telefone: ${profileData.telefone || 'Não informado'}
Status: ${profileData.profile_status}
Data de Cadastro: ${dataFormatada}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Acesse o portal de administração:
${portalUrl}

────────────────────────────────────
Portal Regional Vale do Paraíba I - SP
Esta é uma notificação automática do sistema de gestão.
  `.trim();
  
  return { html, text };
}

/**
 * Renderiza template de notificação de erro crítico do sistema
 */
export function renderSystemErrorTemplate(data: {
  tipo: string;
  origem: string;
  rota: string;
  mensagem: string;
  detalhes: any;
  created_at: string;
}): { html: string; text: string } {
  
  const portalUrl = 'https://48ecd9cb-adf8-4eee-8548-c826c493e103.lovableproject.com/';
  const dataFormatada = new Date(data.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });

  // Ícone baseado no tipo
  const iconMap: Record<string, string> = {
    'AUTH_ERROR': '🔒',
    'PERMISSION_DENIED': '🚫',
    'FUNCTION_ERROR': '⚠️',
    'NETWORK_ERROR': '🌐',
    'VALIDATION_ERROR': '📝',
    'DATABASE_ERROR': '💾',
    'UNKNOWN_ERROR': '❓'
  };
  const icon = iconMap[data.tipo] || '🚨';

  // Formatando detalhes JSON
  const detalhesFormatted = data.detalhes 
    ? JSON.stringify(data.detalhes, null, 2)
    : 'Nenhum detalhe adicional';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alerta de Erro no Sistema</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6; 
          color: #1f2937;
          background-color: #f3f4f6;
          padding: 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white; 
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { font-size: 14px; opacity: 0.95; }
        .content { padding: 32px 24px; }
        .alert-box {
          background: #fef2f2;
          border-left: 4px solid #dc2626;
          padding: 16px;
          margin: 24px 0;
          border-radius: 4px;
        }
        .alert-box strong { color: #991b1b; display: block; margin-bottom: 8px; }
        .data-row { 
          display: flex; 
          padding: 12px 0; 
          border-bottom: 1px solid #e5e7eb;
        }
        .data-row:last-child { border-bottom: none; }
        .label { 
          font-weight: 600; 
          color: #6b7280; 
          min-width: 120px;
        }
        .value { color: #1f2937; flex: 1; }
        .code-block {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 16px;
          margin: 16px 0;
          border-radius: 6px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #374151;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .button-container { text-align: center; margin: 32px 0; }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }
        .footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${icon} Alerta de Erro no Sistema</h1>
          <p>Portal Regional Vale do Paraíba I - SP</p>
        </div>
        
        <div class="content">
          <div class="alert-box">
            <strong>⚠️ Erro Crítico Detectado</strong>
            <p>Um erro crítico foi registrado no sistema e requer atenção.</p>
          </div>

          <h2 style="color: #dc2626; margin-bottom: 16px;">📊 Detalhes do Erro</h2>
          
          <div class="data-row">
            <span class="label">Tipo:</span>
            <span class="value"><strong>${data.tipo}</strong></span>
          </div>
          <div class="data-row">
            <span class="label">Origem:</span>
            <span class="value">${data.origem}</span>
          </div>
          <div class="data-row">
            <span class="label">Rota:</span>
            <span class="value">${data.rota}</span>
          </div>
          <div class="data-row">
            <span class="label">Data/Hora:</span>
            <span class="value">${dataFormatada}</span>
          </div>
          <div class="data-row">
            <span class="label">Mensagem:</span>
            <span class="value">${data.mensagem}</span>
          </div>

          <h3 style="margin-top: 24px; margin-bottom: 12px; color: #374151;">🔍 Informações Técnicas</h3>
          <div class="code-block">${detalhesFormatted}</div>

          <div class="button-container">
            <a href="${portalUrl}" class="button">
              🔐 Acessar Portal de Administração →
            </a>
          </div>

          <div class="footer">
            <p><strong>Portal Regional Vale do Paraíba I - SP</strong></p>
            <p>Esta é uma notificação automática do sistema de monitoramento.</p>
            <p>Para parar de receber estes alertas, ajuste suas configurações no portal.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
🚨 ALERTA DE ERRO NO SISTEMA
Portal Regional Vale do Paraíba I - SP

⚠️ ERRO CRÍTICO DETECTADO
Um erro crítico foi registrado no sistema e requer atenção.

📊 DETALHES DO ERRO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tipo: ${data.tipo}
Origem: ${data.origem}
Rota: ${data.rota}
Data/Hora: ${dataFormatada}
Mensagem: ${data.mensagem}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 INFORMAÇÕES TÉCNICAS:
${detalhesFormatted}

Acesse o portal de administração:
${portalUrl}

────────────────────────────────────────
Portal Regional Vale do Paraíba I - SP
Esta é uma notificação automática do sistema de monitoramento.
  `.trim();

  return { html, text };
}

/**
 * Renderiza template de notificação de mudança de status de perfil
 */
export function renderProfileStatusChangeTemplate(data: {
  nome_colete: string;
  name: string;
  status_anterior: string;
  status_novo: string;
  observacao: string | null;
}): { html: string; text: string } {
  const portalUrl = 'https://48ecd9cb-adf8-4eee-8548-c826c493e103.lovableproject.com/';
  
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Atualização de Status - Portal Regional VP1</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6; 
          color: #1f2937;
          background-color: #f3f4f6;
          padding: 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white; 
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 14px;
          opacity: 0.95;
        }
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
        }
        .intro {
          font-size: 15px;
          color: #4b5563;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .status-box {
          background: #f9fafb;
          border-left: 4px solid #dc2626;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .status-row:last-child {
          border-bottom: none;
        }
        .status-label {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-value {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          padding: 6px 12px;
          background: white;
          border-radius: 6px;
          border: 2px solid #e5e7eb;
        }
        .status-value.novo {
          color: #dc2626;
          border-color: #dc2626;
          background: #fef2f2;
        }
        .observacao-box {
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .observacao-box h3 {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .observacao-box p {
          font-size: 14px;
          color: #78350f;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
        }
        .footer {
          background: #f9fafb;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          font-size: 13px;
          color: #6b7280;
          margin: 4px 0;
        }
        .footer strong {
          color: #1f2937;
        }
        @media only screen and (max-width: 600px) {
          body { padding: 10px; }
          .content { padding: 20px 16px; }
          .header { padding: 24px 16px; }
          .header h1 { font-size: 20px; }
          .status-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Atualização de Status</h1>
          <p>Portal Regional Vale do Paraíba I - SP</p>
        </div>
        <div class="content">
          <p class="greeting">Olá, ${data.nome_colete || data.name}!</p>
          <p class="intro">
            O status do seu cadastro no Portal Regional foi atualizado por um administrador.
            Confira as informações abaixo:
          </p>
          
          <div class="status-box">
            <div class="status-row">
              <span class="status-label">Status Anterior</span>
              <span class="status-value">${data.status_anterior}</span>
            </div>
            <div class="status-row">
              <span class="status-label">Novo Status</span>
              <span class="status-value novo">${data.status_novo}</span>
            </div>
          </div>
          
          ${data.observacao ? `
          <div class="observacao-box">
            <h3>💬 Observação do Administrador</h3>
            <p>${data.observacao}</p>
          </div>
          ` : ''}
          
          <div class="button-container">
            <a href="${portalUrl}" class="button">
              🔐 Acessar Portal Regional →
            </a>
          </div>
          
          <div class="footer">
            <p><strong>Portal Regional Vale do Paraíba I - SP</strong></p>
            <p>Esta é uma notificação automática do sistema de gestão.</p>
            <p>Em caso de dúvidas, entre em contato com a administração.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
ATUALIZAÇÃO DE STATUS
Portal Regional Vale do Paraíba I - SP

Olá, ${data.nome_colete || data.name}!

O status do seu cadastro no Portal Regional foi atualizado por um administrador.

MUDANÇA DE STATUS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status Anterior: ${data.status_anterior}
Novo Status: ${data.status_novo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data.observacao ? `
OBSERVAÇÃO DO ADMINISTRADOR:
${data.observacao}

` : ''}
Acesse o portal para mais informações:
${portalUrl}

────────────────────────────────────
Portal Regional Vale do Paraíba I - SP
Esta é uma notificação automática do sistema de gestão.
Em caso de dúvidas, entre em contato com a administração.
  `.trim();
  
  return { html, text };
}
