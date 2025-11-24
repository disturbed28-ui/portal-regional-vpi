import { supabase } from "@/integrations/supabase/client";

export type LogEventType = 
  | 'AUTH_ERROR'
  | 'PERMISSION_DENIED'
  | 'FUNCTION_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

interface LogEventPayload {
  tipo: LogEventType;
  origem: string;
  rota?: string;
  mensagem?: string;
  detalhes?: Record<string, any>;
}

/**
 * Registra um evento de erro no sistema via edge function log-system-event.
 * Resiliente: se falhar, apenas loga no console sem quebrar a aplicação.
 * 
 * @param payload - Dados do evento a ser registrado
 */
export async function logSystemEventFromClient(payload: LogEventPayload): Promise<void> {
  try {
    // Adicionar pathname atual se não fornecido
    if (!payload.rota && typeof window !== 'undefined') {
      payload.rota = window.location.pathname;
    }

    console.log('[logSystemEvent] 📤 Enviando log:', {
      tipo: payload.tipo,
      origem: payload.origem,
      rota: payload.rota
    });

    const { error } = await supabase.functions.invoke('log-system-event', {
      body: payload
    });

    if (error) {
      console.error('[logSystemEvent] ❌ Falha ao enviar log:', error);
    } else {
      console.log('[logSystemEvent] ✅ Log enviado com sucesso');
    }
  } catch (err) {
    // Não lançar erro para não quebrar o fluxo da aplicação
    console.error('[logSystemEvent] ⚠️ Exceção ao enviar log:', err);
  }
}
