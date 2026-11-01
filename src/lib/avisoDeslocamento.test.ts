import { describe, expect, test } from "bun:test";
import { validarAviso, intervaloHistorico, type AvisoSimplificado } from "./avisoDeslocamento";
const base: AvisoSimplificado = { tipo_aviso: "dentro_regional", nome_colete: "R.I.P", divisao_texto: "Centro SJC", cidade_origem: "Flamboyant", cidade_destino: "Jardim Oriente", meio_transporte: "moto", acompanhante_tipo: null, contato_regional: null };
describe("Avisos simplificados", () => {
  test("bairros da mesma cidade sem datas ou horários são válidos", () => {
    expect(validarAviso(base)).toEqual([]);
  });
  test("entre regionais exige escolha de acompanhante", () => {
    expect(validarAviso({ ...base, tipo_aviso: "entre_regionais", contato_regional: false })).toEqual(["Acompanhante"]);
  });
  test("entre regionais exige contato sim ou não e aceita não", () => {
    expect(validarAviso({ ...base, tipo_aviso: "entre_regionais", acompanhante_tipo: "filho" })).toEqual(["Necessário contato regional"]);
    expect(validarAviso({ ...base, tipo_aviso: "entre_regionais", acompanhante_tipo: "filho", contato_regional: false })).toEqual([]);
  });
  test("período inclui dias inteiros no horário brasileiro", () => {
    expect(intervaloHistorico("2026-11-01", "2026-11-30")).toEqual({ inicio: "2026-11-01T03:00:00.000Z", fim: "2026-12-01T02:59:59.999Z" });
  });
});