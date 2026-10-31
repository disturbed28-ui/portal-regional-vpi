// @ts-expect-error bun test runtime
import { describe, expect, test } from "bun:test";
import { cargosDoHistorico, correspondeCargoHistorico, lerTodasPaginasHistorico } from "./historicoFormacao";
import { linhasHistoricoFormacao } from "./exportarHistoricoFormacao";

describe("histórico de formação", () => {
  test("filtra pelo ID do cargo treinado ou estagiado", () => {
    expect(correspondeCargoHistorico("social", "social")).toBe(true);
    expect(correspondeCargoHistorico("diretor", "social")).toBe(false);
    expect(correspondeCargoHistorico("diretor", "todos")).toBe(true);
  });
  test("oferece um item por cargo", () => {
    expect(cargosDoHistorico([{ id: "a", nome: "Social" }, { id: "a", nome: "Social" }, { id: "b", nome: "Diretor" }])).toEqual([{ id: "b", nome: "Diretor" }, { id: "a", nome: "Social" }]);
  });
  test("exportação inclui registros em andamento e concluídos com o cargo de cada formação", () => {
    const base = { id: "1", integrante_id: "p", integrante_nome_colete: "Irmão", divisao_id: "d", divisao_nome: "DIVISAO SUL - SP", regional_id: "r", data_inicio: "2026-10-01", solicitante_nome_colete: "Diretor" };
    const linhas = linhasHistoricoFormacao([
      { ...base, cargo_treinamento_id: "a", cargo_treinamento_nome: "Social", status: "Em Andamento" },
      { ...base, id: "2", cargo_estagio_id: "b", cargo_estagio_nome: "Diretor", grau_estagio: "VI", status: "Concluído", data_encerramento: "2026-10-31" },
    ]);
    expect(linhas.length).toBe(2);
    expect(linhas[0]["Cargo"]).toBe("Social");
    expect(linhas[1]["Cargo"]).toBe("Diretor");
    expect(linhas[1]["Data de encerramento"]).toBe("31/10/2026");
  });
  test("lê além do limite de mil registros sem perder a última página", async () => {
    const dados = Array.from({ length: 2001 }, (_, id) => ({ id }));
    const chamadas: number[] = [];
    const registros = await lerTodasPaginasHistorico({ range: async (inicio, fim) => {
      chamadas.push(inicio);
      return { data: dados.slice(inicio, fim + 1), error: null };
    } });
    expect(chamadas).toEqual([0, 1000, 2000]);
    expect(registros.length).toBe(2001);
    expect(registros[2000].id).toBe(2000);
  });
});