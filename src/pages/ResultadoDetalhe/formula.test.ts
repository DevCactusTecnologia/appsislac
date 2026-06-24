import { describe, it, expect } from "vitest";
import { buildValuesByChave, evaluateFormula } from "./formula";
import type { Parametro } from "./types";

const mkParam = (chave: string, valor: string, extra: Partial<Parametro> = {}): Parametro => ({
  nome: chave,
  obrigatorio: false,
  unidade: "",
  refMin: "",
  refMax: "",
  refUnidade: "",
  valor,
  chave,
  rotulo: chave,
  ...extra,
});

describe("evaluateFormula — separação entre expressão e valor de referência", () => {
  it("avalia expressão usando valores das chaves", () => {
    const params: Parametro[] = [
      mkParam("HCT", "45"),
      mkParam("HEM", "5"),
    ];
    const vbc = buildValuesByChave(params);
    expect(evaluateFormula("##HCT##/##HEM##", vbc, 2)).toBe("9");
  });

  it("NÃO mistura a expressão com o valor de referência descritivo", () => {
    // Simula um parâmetro Formula com expressão própria e VR textual.
    // O VR jamais deve ser avaliado como fórmula.
    const vr = "Até 95 fL";
    const expr = "##HCT##/##HEM##*10";
    const params = [mkParam("HCT", "45"), mkParam("HEM", "5")];
    const vbc = buildValuesByChave(params);

    // Avalia a expressão correta → 90
    expect(evaluateFormula(expr, vbc, 0)).toBe("90");

    // O texto descritivo "Até 95 fL" não é uma expressão válida → vazio
    expect(evaluateFormula(vr, vbc, 0)).toBe("");
  });

  it("fallback legado: fórmula gravada em valorReferencia ainda é avaliada quando formula é vazio", () => {
    // Reproduz o helper usado no ResultadoDetalhe: `param.formula || param.valorReferencia`.
    const param: Parametro = mkParam("VCM", "", {
      tipo: "Formula",
      formula: "",
      valorReferencia: "##HCT##/##HEM##*10",
    });
    const params = [mkParam("HCT", "45"), mkParam("HEM", "5"), param];
    const vbc = buildValuesByChave(params);
    const expr = param.formula || param.valorReferencia;
    expect(evaluateFormula(expr, vbc, 0)).toBe("90");
  });

  it("usa formula nova quando ambos estão preenchidos (não mistura com VR)", () => {
    const param: Parametro = mkParam("VCM", "", {
      tipo: "Formula",
      formula: "##HCT##*2",
      valorReferencia: "80 a 95 fL",
    });
    const params = [mkParam("HCT", "10"), param];
    const vbc = buildValuesByChave(params);
    const expr = param.formula || param.valorReferencia;
    expect(evaluateFormula(expr, vbc, 0)).toBe("20");
  });

  it("retorna vazio quando algum valor referenciado falta (modo estrito)", () => {
    const params = [mkParam("HCT", "45"), mkParam("HEM", "")];
    const vbc = buildValuesByChave(params);
    expect(evaluateFormula("##HCT##/##HEM##", vbc, 2)).toBe("");
  });

  it("modo parcial: soma o que estiver preenchido", () => {
    const params = [mkParam("A", "10"), mkParam("B", "20"), mkParam("C", "")];
    const vbc = buildValuesByChave(params);
    expect(evaluateFormula("##A##+##B##+##C##", vbc, 0, true)).toBe("30");
  });

  it("bloqueia expressões com caracteres não permitidos", () => {
    const vbc = { X: "1" };
    // Tentativa de injeção: token "alert" não está no allowlist.
    expect(evaluateFormula("alert(1)", vbc, 0)).toBe("");
  });

  it("respeita casas decimais", () => {
    const params = [mkParam("A", "1"), mkParam("B", "3")];
    const vbc = buildValuesByChave(params);
    expect(evaluateFormula("##A##/##B##", vbc, 3)).toBe("0,333");
  });
});
