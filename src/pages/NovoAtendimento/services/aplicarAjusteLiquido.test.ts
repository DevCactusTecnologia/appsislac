import { describe, it, expect } from "vitest";
import { aplicarAjusteLiquidoNosExames } from "./aplicarAjusteLiquido";
import type { Exame } from "../types";

function ex(partial: Partial<Exame> & Pick<Exame, "id" | "nome" | "valor">): Exame {
  return {
    convenio: "Particular",
    material: "Sangue",
    cobrancaDestino: "paciente",
    ...partial,
  } as Exame;
}

describe("aplicarAjusteLiquidoNosExames", () => {
  it("retorna a mesma lista quando não há exames do paciente (todos no convênio)", () => {
    const exames = [ex({ id: 1, nome: "A", valor: 100, cobrancaDestino: "convenio" })];
    const out = aplicarAjusteLiquidoNosExames(exames, -10);
    expect(out).toEqual(exames);
  });

  it("aplica desconto distribuído proporcionalmente e preserva valorOriginal", () => {
    const exames = [
      ex({ id: 1, nome: "A", valor: 100 }),
      ex({ id: 2, nome: "B", valor: 100 }),
    ];
    const out = aplicarAjusteLiquidoNosExames(exames, -50);
    expect(out[0].valorOriginal).toBe(100);
    expect(out[1].valorOriginal).toBe(100);
    expect(out[0].valor + out[1].valor).toBeCloseTo(150, 2);
  });

  it("desconto é limitado ao subtotal (não negativa valor)", () => {
    const exames = [ex({ id: 1, nome: "A", valor: 50 })];
    const out = aplicarAjusteLiquidoNosExames(exames, -1000);
    expect(out[0].valor).toBe(0);
    expect(out[0].valorOriginal).toBe(50);
  });

  it("acréscimo não tem teto superior", () => {
    const exames = [ex({ id: 1, nome: "A", valor: 100 })];
    const out = aplicarAjusteLiquidoNosExames(exames, 200);
    expect(out[0].valor).toBe(300);
    expect(out[0].valorOriginal).toBe(100);
  });

  it("ignora exames cobrados do convênio no rateio", () => {
    const exames = [
      ex({ id: 1, nome: "A", valor: 100 }),
      ex({ id: 2, nome: "B", valor: 100, cobrancaDestino: "convenio" }),
    ];
    const out = aplicarAjusteLiquidoNosExames(exames, -50);
    expect(out[1]).toEqual(exames[1]);
    expect(out[0].valor).toBe(50);
  });

  it("ajuste 0 retorna valores inalterados (mas seta valorOriginal)", () => {
    const exames = [ex({ id: 1, nome: "A", valor: 100 })];
    const out = aplicarAjusteLiquidoNosExames(exames, 0);
    expect(out[0].valor).toBe(100);
    expect(out[0].valorOriginal).toBe(100);
  });
});
