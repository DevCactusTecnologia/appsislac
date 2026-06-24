// Pipeline puro de avaliação de resultados críticos.
// Extraído de ResultadoDetalhe.tsx (Fase 1 — Architectural Split Program).
// Fase 1 — Críticos por sexo/idade: aceita um lookup opcional para sobrescrever
// os limites críticos padrão com valores específicos da faixa de sexo+idade do
// paciente (vindos de `valores_referencia.critico_min/max`).
import { avaliarCritico, type NivelCritico } from "@/domains/result/services/criticoChecker";
import type { ExameParametro } from "@/data/exameParametrosStore";

/** Lookup opcional para sobrescrever críticos por sexo/idade. */
export type CriticoOverrideLookup = (
  exameNome: string,
  paramNome: string,
) => { criticoMin?: string; criticoMax?: string } | undefined;

/**
 * Avalia o nível crítico de UM parâmetro consultando a configuração
 * (critico_min/critico_max) cadastrada em ParametrosDialog. Match por
 * rótulo OU chave (case-insensitive).
 *
 * Se `overrideLookup` retornar valores não-vazios para o parâmetro, eles
 * substituem o crítico padrão do `exame_parametros`.
 */
export function avaliarNivelCriticoPure(
  parametrosConfigPorExame: Record<string, ExameParametro[]>,
  exameNome: string,
  paramNome: string,
  valor: string,
  overrideLookup?: CriticoOverrideLookup,
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

  // Override por sexo/idade tem prioridade quando preenchido.
  const ov = overrideLookup?.(exameNome, paramNome);
  const min = (ov?.criticoMin && ov.criticoMin.trim()) ? ov.criticoMin : cfg.criticoMin;
  const max = (ov?.criticoMax && ov.criticoMax.trim()) ? ov.criticoMax : cfg.criticoMax;

  return avaliarCritico(valor, min, max);
}

/** Lista todos os parâmetros críticos de um exame. */
export function getParametrosCriticosDoExamePure(
  parametrosConfigPorExame: Record<string, ExameParametro[]>,
  exame: { nome: string; parametros: Array<{ nome: string; valor: string }> } | undefined,
  overrideLookup?: CriticoOverrideLookup,
): Array<{ nome: string; valor: string; nivel: NivelCritico }> {
  if (!exame) return [];
  const out: Array<{ nome: string; valor: string; nivel: NivelCritico }> = [];
  for (const p of exame.parametros) {
    const nivel = avaliarNivelCriticoPure(parametrosConfigPorExame, exame.nome, p.nome, p.valor, overrideLookup);
    if (nivel !== "normal") out.push({ nome: p.nome, valor: p.valor, nivel });
  }
  return out;
}
