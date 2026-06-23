// Pipeline puro de avaliação de resultados críticos.
// Extraído de ResultadoDetalhe.tsx (Fase 1 — Architectural Split Program).
// Comportamento preservado literalmente.
import { avaliarCritico, type NivelCritico } from "@/domains/result/services/criticoChecker";
import type { ExameParametro } from "@/data/exameParametrosStore";

/**
 * Avalia o nível crítico de UM parâmetro consultando a configuração
 * (critico_min/critico_max) cadastrada em ParametrosDialog. Match por
 * rótulo OU chave (case-insensitive).
 */
export function avaliarNivelCriticoPure(
  parametrosConfigPorExame: Record<string, ExameParametro[]>,
  exameNome: string,
  paramNome: string,
  valor: string,
): NivelCritico {
  if (!valor) return "normal";
  const lista = parametrosConfigPorExame[exameNome];
  if (!lista || lista.length === 0) return "normal";
  const k = paramNome.trim().toLowerCase();
  const cfg = lista.find(
    (p) =>
      p.rotulo.trim().toLowerCase() === k ||
      p.chave.trim().toLowerCase() === k,
  );
  if (!cfg) return "normal";
  return avaliarCritico(valor, cfg.criticoMin, cfg.criticoMax);
}

/** Lista todos os parâmetros críticos de um exame. */
export function getParametrosCriticosDoExamePure(
  parametrosConfigPorExame: Record<string, ExameParametro[]>,
  exame: { nome: string; parametros: Array<{ nome: string; valor: string }> } | undefined,
): Array<{ nome: string; valor: string; nivel: NivelCritico }> {
  if (!exame) return [];
  const out: Array<{ nome: string; valor: string; nivel: NivelCritico }> = [];
  for (const p of exame.parametros) {
    const nivel = avaliarNivelCriticoPure(parametrosConfigPorExame, exame.nome, p.nome, p.valor);
    if (nivel !== "normal") out.push({ nome: p.nome, valor: p.valor, nivel });
  }
  return out;
}
