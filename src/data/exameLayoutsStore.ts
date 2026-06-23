// ============================================================================
// OWNERSHIP OFICIAL — Layout Científico do exame
// ----------------------------------------------------------------------------
// Esta store representa o MOTOR CIENTÍFICO/REGULATÓRIO do laudo:
//   • metodologia, unidade, VR, cálculos, interpretação, renderização clínica.
// NÃO é template de impressão operacional. NÃO é workflow de bancada.
// O workflow operacional vive em `mapaTrabalhoStore.ts` (Mapa de Trabalho).
//
// Quando reagente / método / equipamento / VR / cálculo mudar:
//   → criar NOVO layout + NOVO snapshot (preserva verdade histórica RDC 786/2023).
//   → NUNCA editar layout/snapshot histórico.
//
// Ver: .lovable/memory/architecture/layout-vs-mapa.md
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface ExameLayout {
  id: number;
  exameId: string;
  nome: string;
  conteudo: string;
  padrao: boolean;
  criadoPor: string;
  criadoEm: string;
  config?: LayoutConfig;
  // ─── Campos científicos oficiais (Exames 2.2) ─────────────────────────────
  // Movidos de `exames_catalogo`. Esta é a FONTE DE VERDADE científica do
  // exame (RDC 786/2023). Snapshot regulatório lê daqui na liberação.
  metodologia: string;
  unidadePadrao: string;
  textoInterpretativoPadrao: string;
  exibirMetodologiaLaudo: boolean;
  exibirUnidadeLaudo: boolean;
  exibirMaterialLaudo: boolean;
}

export interface LayoutMargins { top: number; right: number; bottom: number; left: number; }
export interface LayoutConfig { margins?: LayoutMargins; [k: string]: unknown; }

const cache = new Map<string, ExameLayout[]>();
const listeners = new Map<string, Set<() => void>>();

const LAYOUT_COLUMNS =
  "id, exame_id, nome, conteudo, padrao, criado_por, created_at, config, " +
  "metodologia, unidade_padrao, texto_interpretativo_padrao, " +
  "exibir_metodologia_laudo, exibir_unidade_laudo, exibir_material_laudo";

const fromRow = (r: any): ExameLayout => ({
  id: r.id,
  exameId: r.exame_id,
  nome: r.nome ?? "",
  conteudo: r.conteudo ?? "",
  padrao: !!r.padrao,
  criadoPor: r.criado_por ?? "",
  criadoEm: r.created_at ?? "",
  config: (r.config && typeof r.config === "object") ? r.config : {},
  metodologia: r.metodologia ?? "",
  unidadePadrao: r.unidade_padrao ?? "",
  textoInterpretativoPadrao: r.texto_interpretativo_padrao ?? "",
  exibirMetodologiaLaudo: r.exibir_metodologia_laudo !== false,
  exibirUnidadeLaudo: r.exibir_unidade_laudo !== false,
  exibirMaterialLaudo: !!r.exibir_material_laudo,
});

const toRow = (l: Partial<ExameLayout>): any => ({
  ...(l.exameId !== undefined && { exame_id: l.exameId }),
  ...(l.nome !== undefined && { nome: l.nome }),
  ...(l.conteudo !== undefined && { conteudo: l.conteudo }),
  ...(l.padrao !== undefined && { padrao: l.padrao }),
  ...(l.criadoPor !== undefined && { criado_por: l.criadoPor }),
  ...(l.config !== undefined && { config: l.config }),
  ...(l.metodologia !== undefined && { metodologia: l.metodologia }),
  ...(l.unidadePadrao !== undefined && { unidade_padrao: l.unidadePadrao }),
  ...(l.textoInterpretativoPadrao !== undefined && { texto_interpretativo_padrao: l.textoInterpretativoPadrao }),
  ...(l.exibirMetodologiaLaudo !== undefined && { exibir_metodologia_laudo: l.exibirMetodologiaLaudo }),
  ...(l.exibirUnidadeLaudo !== undefined && { exibir_unidade_laudo: l.exibirUnidadeLaudo }),
  ...(l.exibirMaterialLaudo !== undefined && { exibir_material_laudo: l.exibirMaterialLaudo }),
});

const notify = (exameId: string) => {
  listeners.get(exameId)?.forEach((fn) => fn());
};

export async function loadLayouts(exameId: string): Promise<ExameLayout[]> {
  const { data, error } = await supabase
    .from("exame_layouts")
    .select(LAYOUT_COLUMNS)
    .eq("exame_id", exameId)
    .order("padrao", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) { showError(error, { scope: "exameLayoutsStore.load", silent: true }); return []; }
  const list = (data ?? []).map(fromRow);
  cache.set(exameId, list);
  notify(exameId);
  return list;
}

export const getLayouts = (exameId: string): ExameLayout[] =>
  cache.get(exameId) ?? [];

// Garante que apenas 1 layout seja padrão por exame: limpa os outros antes
async function clearPadrao(exameId: string, exceptId?: number) {
  const list = cache.get(exameId) ?? [];
  const toClear = list.filter((l) => l.padrao && l.id !== exceptId);
  if (toClear.length === 0) return;
  await persistOrThrow(
    supabase.from("exame_layouts").update({ padrao: false }).in("id", toClear.map((l) => l.id)),
    "exameLayouts.clearPadrao",
    { expectAtLeast: 0 },
  );
  cache.set(
    exameId,
    list.map((l) => (l.id !== exceptId ? { ...l, padrao: false } : l))
  );
}

export async function addLayout(
  exameId: string,
  data: Omit<ExameLayout, "id" | "exameId" | "criadoEm">
): Promise<ExameLayout | null> {
  try {
    if (data.padrao) await clearPadrao(exameId);
    const tenant_id = await getCurrentTenantId();
    const row = await persistOneOrThrow<any>(
      supabase.from("exame_layouts").insert({ ...toRow({ ...data, exameId }), tenant_id }),
      "exameLayouts.add",
    );
    const novo = fromRow(row);
    cache.set(exameId, [...(cache.get(exameId) ?? []), novo]);
    notify(exameId);
    return novo;
  } catch (e) {
    showError(e, { scope: "exameLayoutsStore.add" });
    return null;
  }
}

export async function updateLayout(
  id: number,
  exameId: string,
  data: Partial<Omit<ExameLayout, "id" | "exameId" | "criadoEm">>
): Promise<boolean> {
  try {
    if (data.padrao) await clearPadrao(exameId, id);
    await persistOrThrow(
      supabase.from("exame_layouts").update(toRow(data)).eq("id", id),
      "exameLayouts.update",
    );
    const list = cache.get(exameId) ?? [];
    cache.set(exameId, list.map((l) => (l.id === id ? { ...l, ...data } : l)));
    notify(exameId);
    return true;
  } catch (e) {
    showError(e, { scope: "exameLayoutsStore.update" });
    return false;
  }
}

export async function removeLayout(id: number, exameId: string): Promise<boolean> {
  try {
    await persistOrThrow(
      supabase.from("exame_layouts").delete().eq("id", id),
      "exameLayouts.remove",
    );
    const list = cache.get(exameId) ?? [];
    cache.set(exameId, list.filter((l) => l.id !== id));
    notify(exameId);
    return true;
  } catch (e) {
    showError(e, { scope: "exameLayoutsStore.remove" });
    return false;
  }
}

export function subscribeLayouts(exameId: string, fn: () => void): () => void {
  if (!listeners.has(exameId)) listeners.set(exameId, new Set());
  listeners.get(exameId)!.add(fn);
  return () => listeners.get(exameId)?.delete(fn);
}
