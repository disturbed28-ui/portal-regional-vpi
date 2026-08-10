/**
 * Meta de crescimento mensal da regional (expectativa do Comando Mundial: +4% ao mês).
 *
 * Regra: o saldo líquido (entradas - saídas) acumulado dos períodos já lançados do mês
 * precisa atingir 4% da base de integrantes do fim do mês anterior.
 */

export const META_PERCENTUAL = 4;

export interface MetaCrescimentoResultado {
  base: number;
  metaIntegrantes: number;
  entradas: number;
  saidas: number;
  saldo: number;
  percentual: number;
  faltam: number;
  excedente: number;
  atingida: boolean;
  baseDisponivel: boolean;
  status: 'atingida' | 'atencao' | 'critica' | 'sem_base';
  mensagem: string;
}

export function calcularMetaCrescimento(
  base: number,
  entradas: number,
  saidas: number
): MetaCrescimentoResultado {
  const baseDisponivel = base > 0;
  const metaIntegrantes = baseDisponivel ? Math.ceil((base * META_PERCENTUAL) / 100) : 0;
  const saldo = entradas - saidas;
  const percentual = baseDisponivel ? (saldo / base) * 100 : 0;
  const faltam = Math.max(0, metaIntegrantes - saldo);
  const excedente = Math.max(0, saldo - metaIntegrantes);
  const atingida = baseDisponivel && saldo >= metaIntegrantes;

  let status: MetaCrescimentoResultado['status'];
  let mensagem: string;

  const pct = percentual.toFixed(1).replace('.', ',');

  if (!baseDisponivel) {
    status = 'sem_base';
    mensagem =
      'Base do mês anterior indisponível — não é possível calcular a meta de 4% de crescimento.';
  } else if (atingida) {
    status = 'atingida';
    mensagem =
      `META ATINGIDA: crescimento de ${pct}% (meta 4% = ${metaIntegrantes} integrante(s), base ${base}).` +
      (excedente > 0
        ? ` Excedente de ${excedente} integrante(s) fica para o booking do próximo mês.`
        : '');
  } else if (saldo > 0) {
    status = 'atencao';
    mensagem = `ATENÇÃO: crescimento de ${pct}% — faltam ${faltam} integrante(s) para a meta de 4% (base ${base} = ${metaIntegrantes} integrante(s)).`;
  } else {
    status = 'critica';
    mensagem = `ALERTA: crescimento de ${pct}% (saldo ${saldo}) — faltam ${faltam} integrante(s) para a meta de 4% (base ${base} = ${metaIntegrantes} integrante(s)).`;
  }

  return {
    base,
    metaIntegrantes,
    entradas,
    saidas,
    saldo,
    percentual,
    faltam,
    excedente,
    atingida,
    baseDisponivel,
    status,
    mensagem,
  };
}

/** Normaliza nome de divisão para comparação (MAIÚSCULO sem acentos). */
export function normalizarNomeDivisao(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}
