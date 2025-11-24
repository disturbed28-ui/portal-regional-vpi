import { createTransport } from 'npm:nodemailer@6.9.7';
import type { Transporter } from 'npm:nodemailer@6.9.7';

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

let transporter: Transporter | null = null;

export async function initializeEmailService() {
  if (transporter) return transporter;

  console.log('[email-service] Inicializando transporter SMTP...');
  
  transporter = createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
    secure: Deno.env.get('SMTP_SECURE') === 'ssl',
    auth: {
      user: Deno.env.get('SMTP_USER'),
      pass: Deno.env.get('SMTP_PASS'),
    },
  });

  console.log('[email-service] Verificando conexão SMTP...');
  await transporter.verify();
  console.log('[email-service] ✅ Conexão SMTP verificada com sucesso!');
  
  return transporter;
}

export async function sendEmail(config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const emailTransporter = await initializeEmailService();
    
    console.log('[email-service] Enviando email para:', config.to);
    console.log('[email-service] CC:', config.cc || 'Nenhum');
    
    const info = await emailTransporter.sendMail({
      from: `"Portal Regional VP1" <${Deno.env.get('SMTP_USER')}>`,
      to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
      cc: config.cc ? (Array.isArray(config.cc) ? config.cc.join(', ') : config.cc) : undefined,
      subject: config.subject,
      html: config.html,
      text: config.text || config.subject,
    });

    console.log('[email-service] ✅ Email enviado com sucesso! Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
    
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
