import { describe, expect, test } from "bun:test";
import { calcularPeriodoAtual } from "./normalizeText";
import { intervalosAcoesSociais, montarAcoesSociaisRelatorio } from "./acoesSociaisRelatorio";

const registro = (id: string, data_acao: string) => ({ id, data_acao, escopo_acao: "Divisão" });

describe("Ações sociais do relatório CMD", () => {
  test("ação do período aparece só uma vez, nunca como antiga", () => {
    const periodo = calcularPeriodoAtual(new Date(2026, 10, 9));
    const acao = registro("acao-novembro", "2026-11-02");
    const itens = montarAcoesSociaisRelatorio([acao, acao], periodo);
    expect(itens).toHaveLength(1);
    expect(itens[0]?.marcador_relatorio).toBe("semana_atual");
  });
  test("ação antiga realmente não lançada permanece disponível", () => {
    const itens = montarAcoesSociaisRelatorio([registro("pendente", "2026-10-25")], calcularPeriodoAtual(new Date(2026, 10, 9)));
    expect(itens).toHaveLength(1);
    expect(itens[0]?.marcador_relatorio).toBe("semana_anterior_nao_reportada");
  });
  test("ação salva anteriormente não reaparece mesmo com flag pendente", () => {
    expect(montarAcoesSociaisRelatorio([registro("salva", "2026-10-25")], calcularPeriodoAtual(new Date(2026, 10, 9)), new Set(["salva"]))).toHaveLength(0);
  });
  test("flag reportada também impede reaparecimento", () => {
    expect(montarAcoesSociaisRelatorio([{ ...registro("salva", "2026-11-02"), foi_reportada_em_relatorio: true }], calcularPeriodoAtual(new Date(2026, 10, 9)))).toHaveLength(0);
  });
  test("períodos de dez dias não se sobrepõem", () => {
    const periodo = calcularPeriodoAtual(new Date(2026, 10, 15));
    expect(intervalosAcoesSociais(periodo)).toEqual({ inicio: "2026-11-11", fim: "2026-11-20", inicioAnterior: "2026-11-01", fimAnterior: "2026-11-10" });
    expect(montarAcoesSociaisRelatorio([registro("limite", "2026-11-10"), registro("inicio", "2026-11-11"), registro("fora", "2026-11-21")], periodo).map(a => a.marcador_relatorio)).toEqual(["semana_anterior_nao_reportada", "semana_atual"]);
  });
  test("primeiro período do ano considera o último período de dezembro", () => {
    expect(intervalosAcoesSociais(calcularPeriodoAtual(new Date(2027, 0, 5)))).toEqual({ inicio: "2027-01-01", fim: "2027-01-10", inicioAnterior: "2026-12-21", fimAnterior: "2026-12-31" });
  });
});