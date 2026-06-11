import { describe, it, expect } from "vitest";
import { buildExamesCobranca } from "./buildExamesCobranca";
import type { Exame } from "./types";

function ex(partial: Partial<Exame> & Pick<Exame, "id" | "nome">): Exame {
  return {
    convenio: "Particular",
    material: "Sangue",
    valor: 0,
    cobrancaDestino: "paciente",
    ...partial,
  } as Exame;
}

describe("buildExamesCobranca", () => {
  it("aplica defaults: amostraSeq=1, grupoExameId=null, tipoProcesso=INTERNO, labApoioId=null, solicitante=''", () => {
    const out = buildExamesCobranca(
      [ex({ id: 1, nome: "Hemograma", valor: 50 })],
      ["Dr. Silva"],
    );
    expect(out).toEqual([
      {
        nome: "Hemograma",
        cobrancaDestino: "paciente",
        convenioCobrancaId: null,
        valor: 50,
        amostraSeq: 1,
        grupoExameId: null,
        tipoProcesso: "INTERNO",
        labApoioId: null,
        solicitante: "",
      },
    ]);
  });

  it("TERCEIRIZADO usa override quando presente", () => {
    const out = buildExamesCobranca(
      [ex({
        id: 1, nome: "PCR", valor: 200,
        tipoProcesso: "TERCEIRIZADO",
        labApoioIdPadrao: "lab-default",
        labApoioIdOverride: "lab-override",
      })],
      ["X"],
    );
    expect(out[0].labApoioId).toBe("lab-override");
  });

  it("TERCEIRIZADO cai no padrão quando não há override", () => {
    const out = buildExamesCobranca(
      [ex({
        id: 1, nome: "PCR", valor: 200,
        tipoProcesso: "TERCEIRIZADO",
        labApoioIdPadrao: "lab-default",
        labApoioIdOverride: null,
      })],
      ["X"],
    );
    expect(out[0].labApoioId).toBe("lab-default");
  });

  it("INTERNO ignora labApoio (sempre null)", () => {
    const out = buildExamesCobranca(
      [ex({
        id: 1, nome: "Glicemia", valor: 25,
        tipoProcesso: "INTERNO",
        labApoioIdPadrao: "lab-x",
        labApoioIdOverride: "lab-y",
      })],
      ["X"],
    );
    expect(out[0].labApoioId).toBeNull();
  });

  it("solicitante por exame só é emitido com >1 solicitantes no atendimento", () => {
    const exames = [ex({ id: 1, nome: "A", solicitanteExame: "Dr. A" })];
    expect(buildExamesCobranca(exames, ["Dr. A"])[0].solicitante).toBe("");
    expect(buildExamesCobranca(exames, ["Dr. A", "Dr. B"])[0].solicitante).toBe("Dr. A");
  });

  it("'__ambos' vira string vazia mesmo com múltiplos solicitantes", () => {
    const out = buildExamesCobranca(
      [ex({ id: 1, nome: "A", solicitanteExame: "__ambos" })],
      ["Dr. A", "Dr. B"],
    );
    expect(out[0].solicitante).toBe("");
  });

  it("cobrancaDestino=convenio preserva convenioCobrancaId", () => {
    const out = buildExamesCobranca(
      [ex({ id: 1, nome: "A", cobrancaDestino: "convenio", convenioCobrancaId: 42 })],
      ["X"],
    );
    expect(out[0].cobrancaDestino).toBe("convenio");
    expect(out[0].convenioCobrancaId).toBe(42);
  });

  it("preserva totais (soma dos valores) e ordem dos exames", () => {
    const out = buildExamesCobranca(
      [
        ex({ id: 1, nome: "A", valor: 10 }),
        ex({ id: 2, nome: "B", valor: 20 }),
        ex({ id: 3, nome: "C", valor: 30 }),
      ],
      ["X"],
    );
    expect(out.map(o => o.nome)).toEqual(["A", "B", "C"]);
    expect(out.reduce((s, o) => s + o.valor, 0)).toBe(60);
  });
});
