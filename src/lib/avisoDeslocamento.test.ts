// @ts-expect-error bun test runtime
import { describe, expect, test } from "bun:test";
import { validarAviso, intervaloHistorico, montarMensagemAviso, type AvisoSimplificado } from "./avisoDeslocamento";
import { montarMensagemProtocolo, type DadosProtocolo } from "./protocoloViagem";
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
  test("observações entram na mensagem do aviso quando preenchidas", () => {
    const msg = montarMensagemAviso({ ...base, observacoes: "  Levar documento da moto  " });
    expect(msg).toContain("*Observações:* Levar documento da moto");
    expect(montarMensagemAviso(base)).not.toContain("Observações");
    expect(montarMensagemAviso({ ...base, observacoes: "   " })).not.toContain("Observações");
  });
});

const protocoloBase: DadosProtocolo = {
  nome_colete: "R.I.P", grau_texto: "VIII", divisao_texto: "Centro SJC", regional_texto: "Vale 1",
  cidade_origem: "SJC", cidade_destino: "RJ", paradas: [], data_saida: "2026-11-10", hora_saida: "08:00",
  data_retorno: "2026-11-12", hora_retorno: "18:00", meio_transporte: "moto", acompanhado: false, com_cores: true, telefone: "12999998888",
};
describe("Protocolo de viagem", () => {
  test("observações entram na mensagem do protocolo quando preenchidas", () => {
    const msg = montarMensagemProtocolo({ ...protocoloBase, observacoes: "Retorno pode atrasar" });
    expect(msg).toContain("*Observações:* Retorno pode atrasar");
    expect(montarMensagemProtocolo(protocoloBase)).not.toContain("Observações");
  });
});