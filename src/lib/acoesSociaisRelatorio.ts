import { calcularPeriodoAnterior, type SemanaOperacional } from "./normalizeText";

interface RegistroAcaoSocial {
  id: string;
  data_acao: string;
  escopo_acao: string;
  tipo_acao_nome_snapshot?: string | null;
  descricao_acao?: string | null;
  foi_reportada_em_relatorio?: boolean;
}

// Date columns need the local calendar day, not the UTC day of endOfDay.
const dataCalendario = (data: Date) =>
  new Date(data.getFullYear(), data.getMonth(), data.getDate(), 12).toISOString().split("T")[0];

export function intervalosAcoesSociais(periodo: SemanaOperacional) {
  const anterior = calcularPeriodoAnterior(periodo.periodo_inicio);
  return {
    inicio: dataCalendario(periodo.periodo_inicio),
    fim: dataCalendario(periodo.periodo_fim),
    inicioAnterior: dataCalendario(anterior.periodo_inicio),
    fimAnterior: dataCalendario(anterior.periodo_fim),
  };
}

export function montarAcoesSociaisRelatorio(
  registros: RegistroAcaoSocial[],
  periodo: SemanaOperacional,
  idsReportados: ReadonlySet<string> = new Set(),
) {
  const limites = intervalosAcoesSociais(periodo);
  const vistos = new Set<string>();
  return registros.flatMap((acao) => {
    if (vistos.has(acao.id) || idsReportados.has(acao.id) || acao.foi_reportada_em_relatorio) return [];
    const atual = acao.data_acao >= limites.inicio && acao.data_acao <= limites.fim;
    const anterior = acao.data_acao >= limites.inicioAnterior && acao.data_acao <= limites.fimAnterior;
    if (!atual && !anterior) return [];
    vistos.add(acao.id);
    return [{
      data_acao: acao.data_acao,
      titulo: acao.tipo_acao_nome_snapshot
        ? `${acao.tipo_acao_nome_snapshot} - ${acao.escopo_acao}` : acao.escopo_acao,
      descricao: acao.descricao_acao || "",
      status: "Concluída",
      origem: "form_acoes_sociais",
      registro_id: acao.id,
      marcador_relatorio: atual ? "semana_atual" : "semana_anterior_nao_reportada",
    }];
  });
}