import { describe, expect, test } from "bun:test";
import { detectarDivisoesNovas } from "./estruturaNovasDivisoes";

const comandos = [{ id: "c5", nome: "COMANDO V" }];
const regionais = [{ id: "vp2", nome: "REGIONAL VALE DO PARAIBA II - SP", sigla: "VP2", comando_id: "c5" }];
const divisoes = [{ id: "d1", nome: "DIVISAO PINDAMONHANGABA - SP" }];

describe("divisões novas na carga", () => {
  test("divisão já existente não é criada", () => {
    expect(detectarDivisoesNovas([{ divisao: "Divisão Pindamonhangaba - SP", regional: "VP2" }], divisoes, regionais, comandos)).toHaveLength(0);
  });
  test("divisão nova com regional conhecida é resolvida sozinha", () => {
    const r = detectarDivisoesNovas([{ divisao: "Taubaté", regional: "Regional Vale do Paraíba II - SP" }], divisoes, regionais, comandos);
    expect(r[0].divisao).toBe("DIVISAO TAUBATE - SP");
    expect(r[0].regional_id).toBe("vp2");
  });
  test("sem regional identificável fica para o usuário escolher", () => {
    const r = detectarDivisoesNovas([{ divisao: "Lorena", regional: "" }], divisoes, regionais, comandos);
    expect(r[0].regional_id).toBeNull();
    expect(r[0].criarRegional).toBe(false);
  });
  test("regional nova com comando conhecido é criada junto", () => {
    const r = detectarDivisoesNovas([{ divisao: "Mogi", regional: "Alto Tiete", comando: "Comando V" }], divisoes, regionais, comandos);
    expect(r[0].criarRegional).toBe(true);
    expect(r[0].comando_id).toBe("c5");
  });
});
