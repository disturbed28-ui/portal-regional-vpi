// @ts-expect-error bun test runtime
import { describe, expect, test } from "bun:test";
import { correspondeRegionalAgenda } from "./filtroRegionalAgenda";

function evento(sigla: string | null, comando = false) {
  return {
    isComandoEvent: comando,
    normalizedComponents: {
      tipoEvento: "Coletamento", divisao: comando ? "CMD" : "Regional",
      divisaoId: null, regionalSigla: sigla,
      isCMD: comando, isRegional: !comando, isCaveira: false,
    },
  };
}

describe("Agenda: regional selecionada inclui Comando", () => {
  test("Coletamento do CMD permanece na Vale do Paraíba 1", () => {
    expect(correspondeRegionalAgenda(evento("CMD", true), "VP1")).toBe(true);
  });
  test("Comando permanece em qualquer regional e sem sigla", () => {
    for (const sigla of ["VP1", "VP2", "VP3", "LN"]) {
      expect(correspondeRegionalAgenda(evento(null, true), sigla)).toBe(true);
    }
  });
  test("eventos da regional e de suas divisões permanecem", () => {
    expect(correspondeRegionalAgenda(evento("VP1"), "VP1")).toBe(true);
  });
  test("eventos de outra regional não são incluídos", () => {
    expect(correspondeRegionalAgenda(evento("VP3"), "VP1")).toBe(false);
  });
  test("Comando Regional não é confundido com evento geral do CMD", () => {
    expect(correspondeRegionalAgenda(evento("VP2", false), "VP1")).toBe(false);
  });
  test("todas mantém todos os eventos já autorizados", () => {
    expect(correspondeRegionalAgenda(evento(null), "todas")).toBe(true);
  });
});