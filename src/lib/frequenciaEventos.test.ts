// @ts-expect-error bun test runtime
import { expect, test } from "bun:test";
import { eventosDaFrequencia, numeroOuPadrao, pesoDoEvento } from "./frequenciaEventos";

test("Combate fica fora do cálculo da frequência", () => {
  const eventos = [
    { id: "1", tipo_evento: "Combate", titulo: "[VP3] Combate - Regional VP3" },
    {
      id: "2",
      tipo_evento: "Outros",
      titulo: "[VP3] Outros - Regional VP3 - COMBATE INSANO - CT03 ARTES MARCIAS",
    },
    { id: "3", tipo_evento: "Reuniao", titulo: "[VP1] Reuniao - Leste SJC" },
    { id: "4", tipo_evento: "Coletamento", titulo: "[VP1] Coletamento - Regional VP1" },
    { id: "5", tipo_evento: "Graduacao", titulo: "[VP1] Graduacao - Regional VP1" },
    // Nome de ação social que contém a palavra "combate" não pode ser descartado.
    { id: "6", tipo_evento: "Acao Social", titulo: "Ação Social - Combate à Fome" },
  ];

  expect(eventosDaFrequencia(eventos).map((e) => e.id)).toEqual(["3", "4", "5", "6"]);
});

test("Graduação e Coletamento valem o mesmo peso e o peso chega como número", () => {
  // O banco devolve o peso como texto ("1.0000").
  const pesos = new Map<string, unknown>([
    ["Coletamento", "1.0000"],
    ["Graduacao", "1.0000"],
    ["Reuniao", "0.5000"],
    ["Pub", "0.6000"],
  ]);

  expect(pesoDoEvento("Coletamento", pesos)).toBe(1);
  expect(pesoDoEvento("Graduacao", pesos)).toBe(1);
  expect(pesoDoEvento("Reuniao", pesos)).toBe(0.5);
  expect(pesoDoEvento("Pub", pesos)).toBe(0.6);
});

test("Tipo sem peso configurado vale 1", () => {
  const pesos = new Map<string, unknown>([["Reuniao", "0.5000"]]);

  expect(pesoDoEvento("Caveira", pesos)).toBe(1);
  expect(pesoDoEvento(null, pesos)).toBe(1);
  expect(pesoDoEvento("", pesos)).toBe(1);
});

test("Peso ausente usa o padrão informado", () => {
  expect(numeroOuPadrao("0.4000", 0.001)).toBe(0.4);
  expect(numeroOuPadrao(undefined, 0.001)).toBe(0.001);
  expect(numeroOuPadrao(null, 0.001)).toBe(0.001);
});
