// Utilitário para exibir status de afastamento (Afastado, Suspenso, Gancho, etc.)
// de forma consistente em telas e relatórios.

export interface AfastamentoStyle {
  label: string;
  className: string;
}

/**
 * Retorna o rótulo e as classes de cor para o badge de afastamento.
 * - Punições (suspenso, gancho, punição) → vermelho
 * - Demais afastamentos (afastado, etc.) → âmbar
 */
export const getAfastamentoStyle = (tipo: string | null | undefined): AfastamentoStyle => {
  const label = (tipo || '').trim();
  const t = label.toLowerCase();

  const isPunicao =
    t.includes('suspens') ||
    t.includes('gancho') ||
    t.includes('punic') ||
    t.includes('punição') ||
    t.includes('expuls');

  return {
    label: label || 'Afastado',
    className: isPunicao
      ? 'border-red-500/50 text-red-500'
      : 'border-amber-500/50 text-amber-500',
  };
};

/**
 * Formata o nome com a nota de status entre parênteses (para exportações).
 * Ex.: "GAMBIT" + "Afastado" => "GAMBIT (Afastado)"
 */
export const formatarNomeComAfastamento = (
  nome: string,
  tipo: string | null | undefined
): string => {
  if (!tipo || !tipo.trim()) return nome;
  return `${nome} (${tipo.trim()})`;
};
