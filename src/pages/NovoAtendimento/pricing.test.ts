import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dos stores antes do import da unidade sob teste.
vi.mock("@/data/convenioStore", () => ({
  getTabelaByConvenioNome: (nome: string) => {
    if (nome === "Particular") return "Própria";
    if (nome === "Unimed") return "CBHPM";
    if (nome === "Bradesco") return "TUSS";
    return "Própria";
  },
}));

const precos: Record<string, Record<string, number>> = {
  "Hemograma": { CBHPM: 50, Própria: 80 },
  "Glicemia": { Própria: 25 },
  "TSH": {},
};

vi.mock("@/data/tabelaPrecoStore", () => ({
  getPrecoExame: (nome: string, tabela: string) => {
    return precos[nome]?.[tabela] ?? null;
  },
}));

import { calculateExamPrice } from "./pricing";

describe("calculateExamPrice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa metaValor quando presente (fonte de verdade do persistido)", () => {
    expect(
      calculateExamPrice({ nomeExame: "Hemograma", convenioNome: "Unimed", metaValor: 123.45 }),
    ).toBe(123.45);
  });

  it("metaValor = 0 ainda é fonte de verdade (não cai no fallback)", () => {
    expect(
      calculateExamPrice({ nomeExame: "Hemograma", convenioNome: "Unimed", metaValor: 0 }),
    ).toBe(0);
  });

  it("resolve pela tabela do convênio quando há cadastro", () => {
    expect(calculateExamPrice({ nomeExame: "Hemograma", convenioNome: "Unimed" })).toBe(50);
  });

  it("cai para Própria quando a tabela do convênio não tem o exame", () => {
    expect(calculateExamPrice({ nomeExame: "Glicemia", convenioNome: "Unimed" })).toBe(25);
  });

  it("Particular usa Própria diretamente", () => {
    expect(calculateExamPrice({ nomeExame: "Hemograma", convenioNome: "Particular" })).toBe(80);
  });

  it("retorna 0 quando não há cadastro em nenhuma tabela (nunca chuta)", () => {
    expect(calculateExamPrice({ nomeExame: "TSH", convenioNome: "Unimed" })).toBe(0);
  });

  it("metaValor null cai no fallback de tabela", () => {
    expect(
      calculateExamPrice({ nomeExame: "Hemograma", convenioNome: "Unimed", metaValor: null }),
    ).toBe(50);
  });
});
