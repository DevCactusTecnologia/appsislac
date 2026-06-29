// historicoResultados — busca resultados anteriores do MESMO paciente
// para cada exame/parâmetro do laudo que esteja com a flag
// "Exibir resultado anterior" ativa (`exibir_anterior = SIM`).
//
// Saída por exame (UI id):
//   - linhaHtml:   "Resultados anteriores: DD/MM/AAAA - CHAVE = valor | …"
//                  usada quando o layout NÃO contém ##GRAFICOHIST##.
//   - graficoHtml: SVG inline para substituir ##GRAFICOHIST## quando o
//                  layout/parâmetro do exame possui o token.
//
// Implementação enxuta: resolve UUID por nome do exame, agrupa parâmetros
// ativos e dispara uma query por exame. Exclui o atendimento corrente.

import { supabase } from "@/integrations/supabase/client";
import type { Exame } from "../types";
import { escapeHtml } from "@/lib/escapeHtml";

export interface ExameHistOutput {
  linhaHtml: string;
  graficoHtml: string;
}

interface ParamHist {
  chave: string;
  rotulo: string;
  abrev: string;
  limite: number;
  pontos: Array<{ data: string; valor: string }>;
}

interface ExameParamRow {
  id: number;
  exame_id: string;
  chave: string;
  rotulo: string;
  abreviacao: string | null;
  exibir_anterior: string | null;
  qtd_resultados_anteriores: number | null;
  visivel: boolean | null;
}

interface PrevRow {
  data_coleta: string | null;
  data_analise: string | null;
  resultados: Record<string, unknown> | null;
}

const fmtDataBR = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};

function renderLinha(params: ParamHist[]): string {
  const partes: string[] = [];
  for (const p of params) {
    for (const pt of p.pontos) {
      const label = (p.abrev || p.chave || p.rotulo).toUpperCase();
      partes.push(`<strong>${escapeHtml(pt.data)}</strong> - ${escapeHtml(label)} = ${escapeHtml(pt.valor)} |`);
    }
  }
  if (!partes.length) return "";
  return `<div class="hist-resultados-anteriores" style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:8pt;color:#000;page-break-inside:avoid;break-inside:avoid;">
    <strong>Resultados anteriores:</strong> ${partes.join(" ")}
  </div>`;
}

function renderChart(p: ParamHist): string {
  const pts = [...p.pontos].reverse(); // cronológico
  const nums = pts.map((pt) => Number(String(pt.valor).replace(",", "."))).filter((n) => Number.isFinite(n));
  if (nums.length === 0) {
    return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:8pt;color:#666;font-style:italic;">Sem histórico anterior para ${escapeHtml(p.rotulo || p.chave)}.</div>`;
  }
  const w = 280, h = 70, pad = 18;
  const max = Math.max(...nums), min = Math.min(...nums);
  const range = max - min || 1;
  const barW = (w - pad * 2) / nums.length;
  const bars = nums.map((n, i) => {
    const bh = ((n - min) / range) * (h - pad * 2) + 4;
    const x = pad + i * barW + 2;
    const y = h - pad - bh;
    const label = pts[i] ? fmtDataBR(pts[i].data) || pts[i].data : "";
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW - 4}" height="${bh}" fill="#3b3b98"/>
        <text x="${x + (barW - 4) / 2}" y="${y - 3}" font-family="Helvetica" font-size="6.5" text-anchor="middle" fill="#000">${n}</text>
        <text x="${x + (barW - 4) / 2}" y="${h - 4}" font-family="Helvetica" font-size="6" text-anchor="middle" fill="#444">${escapeHtml(label)}</text>
      </g>`;
  }).join("");
  return `<div class="hist-grafico" style="margin:6px 0;page-break-inside:avoid;break-inside:avoid;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:8pt;font-weight:700;color:#000;margin-bottom:2px;">Histórico — ${escapeHtml(p.rotulo || p.chave)}</div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMinYMin meet">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#888" stroke-width="0.5"/>
      ${bars}
    </svg>
  </div>`;
}

export async function fetchHistoricoPorExame(args: {
  pacienteCpf: string;
  excludeProtocolo: string;
  exames: Exame[];
  /** Layout HTML do exame (para detectar ##GRAFICOHIST##). Keyed by UI id. */
  customByExame?: Record<number, string>;
}): Promise<Record<number, ExameHistOutput>> {
  const cpf = (args.pacienteCpf || "").replace(/\D/g, "");
  if (cpf.length !== 11 || args.exames.length === 0) return {};

  // 1) Resolve UUID por nome (1 query).
  const nomes = Array.from(new Set(args.exames.map((e) => (e.nome || "").trim()).filter(Boolean)));
  const { data: exRows } = await supabase
    .from("exames")
    .select("id,nome")
    .in("nome", nomes);
  const uuidByNome: Record<string, string> = {};
  (exRows ?? []).forEach((r) => { uuidByNome[(r.nome || "").trim()] = r.id; });

  // 2) Parâmetros ativos para esses exames (1 query).
  const uuids = Object.values(uuidByNome);
  if (uuids.length === 0) return {};
  const { data: paramRows } = await supabase
    .from("exame_parametros")
    .select("id,exame_id,chave,rotulo,abreviacao,exibir_anterior,qtd_resultados_anteriores,visivel")
    .in("exame_id", uuids);
  const paramsByExameUuid: Record<string, ExameParamRow[]> = {};
  ((paramRows ?? []) as ExameParamRow[]).forEach((p) => {
    if ((p.exibir_anterior ?? "").toUpperCase() !== "SIM") return;
    if (p.visivel === false) return;
    (paramsByExameUuid[p.exame_id] ||= []).push(p);
  });

  const out: Record<number, ExameHistOutput> = {};

  // 3) Para cada exame do laudo, busca atendimentos anteriores do paciente.
  await Promise.all(args.exames.map(async (exame) => {
    const uuid = uuidByNome[(exame.nome || "").trim()];
    if (!uuid) return;
    const ativos = paramsByExameUuid[uuid] ?? [];
    if (ativos.length === 0) return;
    const limGlobal = Math.min(20, Math.max(...ativos.map((p) => p.qtd_resultados_anteriores || 5)));

    const { data, error } = await supabase
      .from("atendimento_exames")
      .select("data_coleta,data_analise,resultados,atendimentos!inner(protocolo,paciente_cpf)")
      .eq("exame_id", uuid)
      .eq("atendimentos.paciente_cpf", cpf)
      .neq("atendimentos.protocolo", args.excludeProtocolo)
      .not("resultados", "is", null)
      .order("data_coleta", { ascending: false, nullsFirst: false })
      .limit(limGlobal);
    if (error || !data) return;

    const params: ParamHist[] = ativos.map((p) => {
      const lim = Math.max(1, p.qtd_resultados_anteriores || 5);
      const pontos: ParamHist["pontos"] = [];
      for (const row of data as unknown as PrevRow[]) {
        if (pontos.length >= lim) break;
        const v = row.resultados?.[p.chave];
        if (v == null || String(v).trim() === "") continue;
        const dt = fmtDataBR(row.data_coleta ?? row.data_analise ?? null);
        pontos.push({ data: dt, valor: String(v).trim() });
      }
      return {
        chave: p.chave,
        rotulo: p.rotulo,
        abrev: p.abreviacao ?? "",
        limite: lim,
        pontos,
      };
    }).filter((p) => p.pontos.length > 0);

    if (params.length === 0) return;
    const layout = args.customByExame?.[exame.id] ?? "";
    const hasToken = /##GRAFICOHIST##/i.test(layout);
    out[exame.id] = {
      linhaHtml: hasToken ? "" : renderLinha(params),
      graficoHtml: hasToken ? params.map(renderChart).join("") : "",
    };
  }));

  return out;
}
