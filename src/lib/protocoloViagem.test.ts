import { describe, expect, it } from "bun:test";
import { ordemDestinatarios } from "./protocoloViagem";

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
