const ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Registro duplicado',
  '23503': 'Referência inválida',
  '23502': 'Campo obrigatório não fornecido',
  '42501': 'Permissão negada',
  'PGRST116': 'Recurso não encontrado',
  'default': 'Erro ao processar solicitação'
};

export function handleDatabaseError(error: any): string {
  const errorCode = error?.code || error?.error_code;
  console.error('[Database Error]', { 
    code: errorCode, 
    message: error?.message,
    details: error?.details 
  });
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default;
}

export function logError(context: string, error: any, additionalInfo?: any) {
  console.error(`[${context}]`, {
    error: error?.message || error,
    details: error?.details,
    ...additionalInfo
  });
}
