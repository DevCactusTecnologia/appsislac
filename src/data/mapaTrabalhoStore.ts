// ============================================================================
// OWNERSHIP OFICIAL — Mapa de Trabalho (workflow operacional de bancada)
// ----------------------------------------------------------------------------
// Esta store representa o FLUXO OPERACIONAL: triagem, agrupamento, ordem de
// bancada, execução e impressão operacional para o analista.
//
// NÃO controla: metodologia, unidade, VR, cálculo, interpretação clínica nem
// renderização científica do laudo. Esses pertencem ao Layout Científico
// (`exameLayoutsStore.ts`) + Snapshot regulatório.
//
// CARDINALIDADE OFICIAL (1:N): cada exame está vinculado a NO MÁXIMO UM mapa
// operacional (constraint `mapa_exames.exame_id UNIQUE`). Um mapa pode conter
// vários exames, mas um exame pertence a um único mapa (ou a nenhum, caindo
// no catch-all `is_catch_all = true`).
//
// CATCH-ALL: o mapa LOTE com `isCatchAll = true` é o destino oficial de
// qualquer exame ativo sem vínculo. É garantido único por tenant via índice
// parcial em DB. Substitui a heurística textual antiga (regex sobre o nome).
//
// LEGACY_RESERVED: os campos `templateKey`, `source`, `layoutJson`,
// `placeholdersUsados` e `config` permanecem no schema por compatibilidade
// histórica, mas NÃO têm runtime ativo nesta versão. Não criar novos usos.
//
// Ver: .lovable/memory/architecture/layout-vs-mapa.md
//      .lovable/memory/architecture/mapa-trabalho-runtime.md
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { extractPlaceholders } from "@/lib/mapaPlaceholders";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { LayoutJson, DocumentoConfig, JsonObject, JsonValue } from "@/types/domain";

export type MapaTipo = "INDIVIDUAL" | "LOTE";

// LEGACY_RESERVED: tipos mantidos apenas por compatibilidade com colunas DB
// que ainda não foram removidas. Não usar em runtime novo.
/** @deprecated LEGACY_RESERVED — sem runtime ativo. */
export type MapaSource = "legacy_html" | "visual_builder";
/** @deprecated LEGACY_RESERVED — sem runtime ativo. */
export type MapaTemplateKey = "auto" | "hemogram" | "hiv" | "urina" | "fezes" | "others";

export interface MapaTrabalho {
  id: string;
  nome: string;
  descricao: string;
  tipo: MapaTipo;
  conteudo: string; // HTML do editor com {{placeholders}}
  /** Catch-all oficial: o mapa LOTE com isCatchAll=true recebe todos os exames sem vínculo. */
  isCatchAll: boolean;
  ativo: boolean;
  sistema: boolean;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  // ── LEGACY_RESERVED ────────────────────────────────────────────────
  /** @deprecated LEGACY_RESERVED — sem runtime ativo. */
  templateKey: MapaTemplateKey;
  /** @deprecated LEGACY_RESERVED — sem runtime ativo. */
  source: MapaSource;
  /** @deprecated LEGACY_RESERVED — sem runtime ativo. */
  layoutJson: LayoutJson;
  /** @deprecated LEGACY_RESERVED — sem runtime ativo. */
  placeholdersUsados: string[];
  /** @deprecated LEGACY_RESERVED — sem runtime ativo. */
  config: DocumentoConfig;
}

type MapaTrabalhoRow = Tables<"mapas_trabalho">;
type MapaTrabalhoInsert = TablesInsert<"mapas_trabalho">;
type MapaTrabalhoUpdate = TablesUpdate<"mapas_trabalho">;
type MapaExameRow = Tables<"mapa_exames">;

const asJsonObject = (v: unknown): JsonObject =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {};

let _mapas: MapaTrabalho[] = [];
let _vinculos: Map<string, Set<string>> = new Map(); // mapa_id -> Set<exame_id>
let _listeners: Array<() => void> = [];
const notify = () => _listeners.forEach((fn) => fn());

const VALID_TEMPLATE_KEYS: MapaTemplateKey[] = [
  "auto", "hemogram", "hiv", "urina", "fezes", "others",
];

const fromRow = (r: MapaTrabalhoRow): MapaTrabalho => ({
  id: r.id,
  nome: r.nome ?? "",
  descricao: r.descricao ?? "",
  tipo: ((r.tipo as MapaTipo) ?? "INDIVIDUAL"),
  conteudo: r.conteudo ?? "",
  isCatchAll: !!(r as MapaTrabalhoRow & { is_catch_all?: boolean }).is_catch_all,
  ativo: !!r.ativo,
  sistema: !!(r as MapaTrabalhoRow & { sistema?: boolean }).sistema,
  criadoPor: r.criado_por ?? "",
  criadoEm: r.created_at ?? "",
  atualizadoEm: r.updated_at ?? "",
  // LEGACY_RESERVED — sem runtime ativo
  templateKey: (VALID_TEMPLATE_KEYS.includes(r.template_key as MapaTemplateKey)
    ? (r.template_key as MapaTemplateKey)
    : "auto"),
  source: (r.source ?? "legacy_html") as MapaSource,
  layoutJson: asJsonObject(r.layout_json),
  placeholdersUsados: Array.isArray(r.placeholders_usados)
    ? (r.placeholders_usados.filter((x): x is string => typeof x === "string"))
    : [],
  config: asJsonObject(r.config),
});

const toRow = (m: Partial<MapaTrabalho>): MapaTrabalhoUpdate => {
  const row: MapaTrabalhoUpdate = {};
  if (m.nome !== undefined) row.nome = m.nome;
  if (m.descricao !== undefined) row.descricao = m.descricao;
  if (m.tipo !== undefined) row.tipo = m.tipo;
  if (m.conteudo !== undefined) {
    row.conteudo = m.conteudo;
    // mantém placeholders_usados sincronizado automaticamente
    row.placeholders_usados = extractPlaceholders(m.conteudo) as unknown as JsonValue;
  }
  if (m.isCatchAll !== undefined) {
    (row as MapaTrabalhoUpdate & { is_catch_all?: boolean }).is_catch_all = m.isCatchAll;
  }
  if (m.ativo !== undefined) row.ativo = m.ativo;
  if (m.criadoPor !== undefined) row.criado_por = m.criadoPor;
  return row;
};

export async function _initMapasTrabalhoStore(): Promise<void> {
  const [{ data: mapas, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
    supabase.from("mapas_trabalho").select("*").order("nome"),
    supabase.from("mapa_exames").select("mapa_id, exame_id"),
  ]);
  if (e1) showError(e1, { scope: "mapaTrabalhoStore.init.mapas", silent: true });
  if (e2) showError(e2, { scope: "mapaTrabalhoStore.init.vinculos", silent: true });
  _mapas = ((mapas ?? []) as MapaTrabalhoRow[]).map(fromRow);
  _vinculos = new Map();
  for (const v of (vinculos ?? []) as Pick<MapaExameRow, "mapa_id" | "exame_id">[]) {
    if (!_vinculos.has(v.mapa_id)) _vinculos.set(v.mapa_id, new Set());
    _vinculos.get(v.mapa_id)!.add(v.exame_id);
  }
  notify();
}

export const getMapasTrabalho = (): MapaTrabalho[] => _mapas;
export const getMapaTrabalhoById = (id: string) => _mapas.find((m) => m.id === id);

export const getExameIdsDoMapa = (mapaId: string): string[] =>
  Array.from(_vinculos.get(mapaId) ?? []);

export const getMapasIdsDoExame = (exameId: string): string[] => {
  const out: string[] = [];
  _vinculos.forEach((set, mapaId) => {
    if (set.has(exameId)) out.push(mapaId);
  });
  return out;
};

/**
 * Cardinalidade oficial 1:N — cada exame está vinculado a no máximo UM mapa
 * (UNIQUE constraint em mapa_exames.exame_id). Esta API retorna o vínculo
 * único (ou null se não houver). Use esta no lugar de `getMapasIdsDoExame`
 * em código novo.
 */
export const getMapaIdDoExame = (exameId: string): string | null => {
  const ids = getMapasIdsDoExame(exameId);
  return ids[0] ?? null;
};

/** Retorna o catch-all oficial (LOTE + isCatchAll=true) ativo, se houver. */
export const getMapaCatchAll = (): MapaTrabalho | undefined =>
  _mapas.find((m) => m.tipo === "LOTE" && m.isCatchAll && m.ativo)
    ?? _mapas.find((m) => m.tipo === "LOTE" && m.isCatchAll);

export async function addMapaTrabalho(
  data: Omit<MapaTrabalho, "id" | "criadoEm" | "atualizadoEm" | "placeholdersUsados">
): Promise<MapaTrabalho | null> {
  try {
    const tenant_id = await getCurrentTenantId();
    const baseRow = toRow(data);
    const insertPayload: MapaTrabalhoInsert = {
      ...baseRow,
      nome: data.nome,
      tenant_id,
    };
    const row = await persistOneOrThrow<MapaTrabalhoRow>(
      supabase.from("mapas_trabalho").insert(insertPayload),
      "mapaTrabalho.add",
    );
    const novo = fromRow(row);
    _mapas = [..._mapas, novo].sort((a, b) => a.nome.localeCompare(b.nome));
    notify();
    return novo;
  } catch (e) {
    showError(e, { scope: "mapaTrabalhoStore.add" });
    return null;
  }
}

export async function updateMapaTrabalho(
  id: string,
  data: Partial<MapaTrabalho>
): Promise<boolean> {
  const prev = _mapas;
  _mapas = _mapas.map((m) => (m.id === id ? { ...m, ...data } : m));
  notify();
  try {
    await persistOrThrow(
      supabase.from("mapas_trabalho").update(toRow(data)).eq("id", id),
      "mapaTrabalho.update",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "mapaTrabalhoStore.update" });
    _mapas = prev;
    notify();
    return false;
  }
}

export async function removeMapaTrabalho(id: string): Promise<boolean> {
  const prev = _mapas;
  const prevVinc = new Map(_vinculos);
  _mapas = _mapas.filter((m) => m.id !== id);
  _vinculos.delete(id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("mapas_trabalho").delete().eq("id", id),
      "mapaTrabalho.remove",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "mapaTrabalhoStore.remove" });
    _mapas = prev;
    _vinculos = prevVinc;
    notify();
    return false;
  }
}

export async function duplicarMapaTrabalho(id: string): Promise<MapaTrabalho | null> {
  const orig = getMapaTrabalhoById(id);
  if (!orig) return null;
  const novo = await addMapaTrabalho({
    nome: `${orig.nome} (cópia)`,
    descricao: orig.descricao,
    tipo: orig.tipo,
    templateKey: orig.templateKey,
    conteudo: orig.conteudo,
    source: orig.source,
    layoutJson: orig.layoutJson,
    config: orig.config,
    ativo: orig.ativo,
    sistema: false,
    criadoPor: orig.criadoPor,
    isCatchAll: false, // cópia nunca é catch-all (único por tenant)
  });
  return novo;
}

/** Define a lista exata de exames vinculados a um mapa (substitui o conjunto atual). */
export async function setExamesDoMapa(mapaId: string, exameIds: string[]): Promise<boolean> {
  const tenant_id = await getCurrentTenantId();
  const atuais = _vinculos.get(mapaId) ?? new Set<string>();
  const novos = new Set(exameIds);
  const adicionar = exameIds.filter((id) => !atuais.has(id));
  const remover = Array.from(atuais).filter((id) => !novos.has(id));

  try {
    if (remover.length > 0) {
      await persistOrThrow(
        supabase.from("mapa_exames").delete().eq("mapa_id", mapaId).in("exame_id", remover),
        "mapaTrabalho.vinculos.remover",
        { expectAtLeast: 0 },
      );
    }
    if (adicionar.length > 0) {
      const rows = adicionar.map((exame_id) => ({ tenant_id, mapa_id: mapaId, exame_id }));
      await persistOrThrow(
        supabase.from("mapa_exames").insert(rows),
        "mapaTrabalho.vinculos.adicionar",
        { expectAtLeast: rows.length },
      );
    }
  } catch (e) {
    showError(e, { scope: "mapaTrabalhoStore.setExames" });
    return false;
  }
  _vinculos.set(mapaId, novos);
  notify();
  return true;
}

export function subscribeMapasTrabalho(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
