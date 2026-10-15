// @ts-expect-error bun test runtime
import { expect, test } from "bun:test";
import { repetirAtePadrao } from "./AdicionarEventoDialog";

test("evento semanal vale 3 meses por padrão", () => {
  expect(repetirAtePadrao("2026-10-19")).toBe("2027-01-19");
});
