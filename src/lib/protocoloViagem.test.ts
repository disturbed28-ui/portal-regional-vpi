// @ts-expect-error bun test runtime
import { describe, expect, it } from "bun:test";
import { destinatarioComAlternativaPropria, ordemDestinatarios, type Destinatario } from "./protocoloViagem";

describe("ordemDestinatarios", () => {
  it("integrante comum: subdiretor primeiro, diretor da divisão se não houver subdiretor", () => {
    expect(ordemDestinatarios("Integrante Grau VIII", true, "VIII")).toEqual([
      "sub_diretor",
      "diretor_divisao",
    ]);
  });

  it("diretor de divisão: subdiretor primeiro, operacional regional se não houver subdiretor", () => {
    expect(ordemDestinatarios("Diretor de Divisão Grau VI", true, "VI")).toEqual([
      "sub_diretor",
      "operacional_regional",
    ]);
    // nunca aponta para o próprio diretor
    expect(ordemDestinatarios("Diretor de Divisão Grau VI", true, "VI")).not.toContain(
      "diretor_divisao",
    );
  });

  it("subdiretor de divisão: diretor da divisão, depois operacional regional", () => {
    expect(ordemDestinatarios("Subdiretor de Divisão Grau VII", true, "VII")).toEqual([
      "diretor_divisao",
      "operacional_regional",
    ]);
  });

  it("grau V: operacional regional, depois diretor regional", () => {
    expect(ordemDestinatarios("Qualquer cargo", true, "V")).toEqual([
      "operacional_regional",
      "diretor_regional",
    ]);
  });

  it("operacional regional: diretor regional", () => {
    expect(ordemDestinatarios("Operacional Regional Grau V", false, null)).toEqual([
      "diretor_regional",
    ]);
  });

  it("integrante da regional sem divisão: operacional, depois diretor regional", () => {
    expect(ordemDestinatarios(null, false, null)).toEqual([
      "operacional_regional",
      "diretor_regional",
    ]);
  });
});

describe("alternativa ao próprio WhatsApp nos avisos", () => {
  const proprio = { nome: "Integrante", telefone: "12999998888", profileId: "remetente" };
  it("sem responsável, usa o telefone e identidade do próprio remetente", () => {
    expect(destinatarioComAlternativaPropria(null, proprio)).toMatchObject({
      tipo: "proprio", nome: "Integrante", telefone: "12999998888", profileId: "remetente", fallback: true,
    });
  });
  it("preserva o responsável disponível em vez de enviar para si mesmo", () => {
    const responsavel: Destinatario = { tipo: "diretor_divisao", nome: "Diretor", telefone: "12988887777",
      profileId: "diretor", fallback: true, tipoPreferido: "sub_diretor" };
    expect(destinatarioComAlternativaPropria(responsavel, proprio)).toBe(responsavel);
  });
  it("responsável sem telefone permite a alternativa própria", () => {
    const responsavel: Destinatario = { tipo: "sub_diretor", nome: "Subdiretor", telefone: null,
      profileId: null, fallback: false, tipoPreferido: "sub_diretor" };
    expect(destinatarioComAlternativaPropria(responsavel, proprio)?.telefone).toBe("12999998888");
  });
  it("sem telefone próprio válido, não inventa um destinatário", () => {
    for (const telefone of [null, "", "   ", "N/A", "123", "123456789012"]) {
      expect(destinatarioComAlternativaPropria(null, { ...proprio, telefone })).toBeNull();
    }
  });
});
