import { describe, expect, it } from "bun:test";
import { formatarNumeroPD, podeCancelar, podeDescartarRascunho } from "./processoDisciplinar";

describe("numeração do PD", () => {
  it("formata como PD 001/2026", () => {
    expect(formatarNumeroPD(1, 2026)).toBe("PD 001/2026");
    expect(formatarNumeroPD(42, 2027)).toBe("PD 042/2027");
  });
  it("rascunho não tem número", () => {
    expect(formatarNumeroPD(null, null)).toBe("Rascunho");
  });
});

describe("cancelamento", () => {
  it("só Regional/Comando cancela PD emitido", () => {
    expect(podeCancelar("emitido", true)).toBe(true);
    expect(podeCancelar("emitido", false)).toBe(false);
  });
  it("não cancela rascunho, concluído ou já cancelado", () => {
    expect(podeCancelar("rascunho", true)).toBe(false);
    expect(podeCancelar("concluido", true)).toBe(false);
    expect(podeCancelar("cancelado", true)).toBe(false);
  });
  it("rascunho só é descartado pelo autor", () => {
    expect(podeDescartarRascunho("rascunho", true)).toBe(true);
    expect(podeDescartarRascunho("rascunho", false)).toBe(false);
    expect(podeDescartarRascunho("emitido", true)).toBe(false);
  });
});
