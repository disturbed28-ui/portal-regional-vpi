// @ts-expect-error bun test runtime
import { describe, expect, it } from "bun:test";
import { formatarNumeroPD, podeCancelar, podeDescartarRascunho, mensagemEncaminhamento, parecerAssinado } from "./processoDisciplinar";

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

describe("versão enviada ao Comando", () => {
  it("envia somente o conteúdo Regional revisado", () => {
    const original = { titulo: "Ocorrência", envolvidos: [{ integrante_id: null, id_clube: 42, nome_colete: "LOBO" }],
      local: "Sede", data_ocorrencia: "2026-10-15", hora_ocorrencia: "13:00", descricao: "Relato original não revisado",
      houve_conciliacao: false, conciliacao_descricao: null };
    const regional = { ...original, descricao: "Resumo revisado pelo Regional" };
    const msg = mensagemEncaminhamento("PD 001/2026", "DIVISAO TESTE - SP", regional, "Parecer objetivo", "PIRATA");
    expect(msg).toContain(regional.descricao);
    expect(msg).not.toContain(original.descricao);
    expect(msg).toContain("LOBO (ID 42)");
    expect(original.descricao).toBe("Relato original não revisado");
  });
  it("coloca a identificação do responsável uma vez ao final do parecer", () => {
    const texto = parecerAssinado("Parecer objetivo", "PIRATA");
    expect(texto).toBe("Parecer objetivo\n\nResponsável pela versão Regional: PIRATA");
    expect(texto.split("PIRATA").length - 1).toBe(1);
  });
});
