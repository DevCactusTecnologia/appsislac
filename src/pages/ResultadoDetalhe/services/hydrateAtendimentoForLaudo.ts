// Hidratação não-React para um atendimento, gerando os artefatos necessários
// para `buildLaudoHtml` (ResultadoDetalhe/services/laudoHtmlBuilder.ts).
//
// É uma reimplementação enxuta de `reloadExames` de ResultadoDetalhe.tsx,
// sem hooks/estado React. Mantém o MESMO pipeline (mesmas funções) para
// preservar fidelidade do laudo gerado em lote vs. impressão individual.

import { supabase } from "@/integrations/supabase/client";
import {
  fetchAtendimentoByProtocolo,
  getAtendimentoExamesDB,
} from "@/data/atendimentoStore";
import { getParametros, loadParametros } from "@/data/exameParametrosStore";
import { getLayouts } from "@/data/exameLayoutsStore";
import { hidratarSegmentosParaDigitacao } from "@/lib/layoutScientificRuntime";
import {
  buildExamesFromDB,
  buildPacienteFromAtendimento,
  calcIdadeAnosMeses,
  isoToBR,
} from "../helpers";
import type { Exame, Paciente, Parametro } from "../types";
import { renderExameComLayout, preloadLayoutsParaExames } from "@/lib/laudoLayout";
import { resolverReferencia } from "@/data/valoresReferenciaStore";
import { buildValuesByChave, evaluateFormula } from "../formula";

export interface HydratedAtendimentoLaudo {
  paciente: Paciente;
  printable: Exame[];
  customByExame: Record<number, string>;
  margins: { top: number; right: number; bottom: number; left: number };
  jejum: boolean;
  /** Resolve VR considerando sexo/idade/jejum do paciente. */
  getResolvedRef: (exameNome: string, param: Parametro) => {
    refMin?: string;
    refMax?: string;
    refUnidade?: string;
  };
}

const LIBERADOS = new Set<string>(["Digitado", "Impresso", "Retificado"]);

export async function hydrateAtendimentoForLaudo(
  protocolo: string,
): Promise<HydratedAtendimentoLaudo | null> {
  const atFromDb = await fetchAtendimentoByProtocolo(protocolo);
  const rowsAll = await getAtendimentoExamesDB(protocolo);
  // Exames terceirizados NUNCA entram na impressão em lote ("Imprimir todos").
  // O laudo é emitido pelo laboratório de apoio; o sistema só recebe o PDF
  // externo, sem parâmetros internos para compor o laudo científico.
  const rows = (rowsAll ?? []).filter((r) => r.tipo_processo !== "TERCEIRIZADO");
  if (rows.length === 0) return null;

  const segmentosPorRowId: Record<number, Awaited<ReturnType<typeof hidratarSegmentosParaDigitacao>>> = {};
  await Promise.all(
    rows.map(async (row) => {
      if (row.tipo_processo === "TERCEIRIZADO") return;
      if (!row.exame_id) return;
      const cached = getParametros(row.exame_id);
      const parametros = cached.length > 0 ? cached : await loadParametros(row.exame_id);
      try {
        const segs = await hidratarSegmentosParaDigitacao(
          row.exame_id,
          row.nome_exame,
          parametros,
          (row.resultados as Record<string, unknown> | null) ?? null,
        );
        segmentosPorRowId[row.id] = segs;
      } catch {
        /* fallback degenerado em buildExamesFromDB */
      }
    }),
  );
  const { exames } = buildExamesFromDB(rows, segmentosPorRowId);
  const paciente = buildPacienteFromAtendimento(protocolo, exames, atFromDb);
  paciente.idade = calcIdadeAnosMeses(paciente.nascimento);

  // Sexo/nascimento via tabela pacientes (igual reloadExames).
  try {
    const cpfDigits = (paciente.cpf || "").replace(/\D/g, "");
    let pacRow: { sexo?: string | null; data_nascimento?: string | null } | null = null;
    if (cpfDigits) {
      const { data } = await supabase
        .from("pacientes")
        .select("sexo, data_nascimento")
        .eq("cpf", cpfDigits)
        .maybeSingle();
      pacRow = data;
    }
    if (!pacRow) {
      const { data } = await supabase
        .from("atendimentos")
        .select("pacientes:paciente_id(sexo, data_nascimento)")
        .eq("protocolo", protocolo)
        .maybeSingle();
      pacRow = (data as { pacientes?: { sexo?: string | null; data_nascimento?: string | null } } | null)?.pacientes ?? null;
    }
    if (pacRow?.sexo) {
      paciente.sexo = pacRow.sexo === "M" ? "Masculino" : pacRow.sexo === "F" ? "Feminino" : pacRow.sexo;
    }
    if (!paciente.nascimento && pacRow?.data_nascimento) {
      paciente.nascimento = pacRow.data_nascimento;
      paciente.idade = calcIdadeAnosMeses(paciente.nascimento);
    }
  } catch { /* mantém defaults */ }

  const jejum = !!atFromDb?.jejum;

  // Imprimíveis = exames com resultado liberado (Digitado/Impresso/Retificado).
  const printable = exames.filter((e) => LIBERADOS.has(e.status));
  if (printable.length === 0) {
    return {
      paciente,
      printable: [],
      customByExame: {},
      margins: { top: 4, right: 11, bottom: 4, left: 11 },
      jejum,
      getResolvedRef: () => ({}),
    };
  }

  // Resolve layouts customizados (mesma lógica do componente).
  await preloadLayoutsParaExames(printable.map((e) => e.nome));
  const fmtDataColeta = (exame: Exame): string => {
    const iso = exame.dataColetaISO || exame.dataAnaliseISO || null;
    if (iso) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        return `Data Coleta: ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour12: false })}`;
      }
    }
    const cadastro = (paciente.dataCadastro || "").trim();
    return cadastro ? `Data Coleta: ${cadastro}` : "";
  };
  const entries = await Promise.all(
    printable.map(async (exame) => {
      const resultados: Record<string, string> = {};
      const valuesByChave = buildValuesByChave(exame.parametros);
      exame.parametros.forEach((p) => {
        let v = p.valor || "";
        if (p.tipo === "Formula") {
          const isCont = (p.chave ?? "").toUpperCase() === "CONT";
          v = evaluateFormula(p.formula || p.valorReferencia, valuesByChave, p.casasDecimais ?? 2, isCont);
        } else if (p.tipo === "Select") {
          v = v.toUpperCase();
        }
        if (p.nome) resultados[p.nome] = v;
        if (p.rotulo) resultados[p.rotulo] = v;
        if (p.chave) resultados[p.chave] = v;
        const abrev = (p as { abreviacao?: string }).abreviacao;
        if (abrev) resultados[abrev] = v;
      });
      const { html, margins } = await renderExameComLayout(
        exame.nome,
        resultados,
        paciente.sexo,
        paciente.idade,
        {
          nome: paciente.nome,
          nascimento: isoToBR(paciente.nascimento),
          cpf: paciente.cpf,
          protocolo: paciente.protocolo,
        },
        fmtDataColeta(exame),
      );
      return { id: exame.id, html, margins };
    }),
  );
  const customByExame: Record<number, string> = {};
  let margins = { top: 4, right: 11, bottom: 4, left: 11 };
  for (const entry of entries) {
    if (entry.html) {
      customByExame[entry.id] = entry.html;
      margins = entry.margins;
    }
  }

  const getResolvedRef = (exameNome: string, param: Parametro) => {
    const resolved =
      (param.chave
        ? resolverReferencia(exameNome, param.chave, paciente.sexo, paciente.idade, false, jejum)
        : null) ||
      resolverReferencia(exameNome, param.nome, paciente.sexo, paciente.idade, false, jejum) ||
      (param.rotulo
        ? resolverReferencia(exameNome, param.rotulo, paciente.sexo, paciente.idade, false, jejum)
        : null);
    if (resolved) return resolved;
    if (param.tipo === "Formula") {
      const vr = param.valorReferencia ?? "";
      const looksLikeLegacyFormula = /##[^#]+##/.test(vr);
      return { refMin: "", refMax: "", refUnidade: "", descricao: looksLikeLegacyFormula ? "" : vr };
    }
    return {
      refMin: param.refMin,
      refMax: param.refMax,
      refUnidade: param.refUnidade,
      descricao: param.valorReferencia ?? "",
    };
  };

  return { paciente, printable, customByExame, margins, jejum, getResolvedRef };
}
