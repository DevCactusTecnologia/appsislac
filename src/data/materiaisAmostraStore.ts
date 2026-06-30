// Catálogo canônico de materiais laboratoriais (Soroteca 2.0 — Fase 4).
//
// SSOT único — Exames 2.3 consolidou material como FK em todas as tabelas
// (`exames_catalogo.material_id`, `atendimento_exames.material_id`,
// `amostras.material_id`). Não há mais coluna `material` (text) nem
// `amostras.tipo_material`. Nomes para UI são resolvidos via cache local.
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";

// ─── Sync cache (hidratado no boot via _initMateriaisAmostraStore) ─────
let _cache: MaterialAmostra[] = [];
const _byId = new Map<string, MaterialAmostra>();
const _byNomeUpper = new Map<string, MaterialAmostra>();
const _bySiglaUpper = new Map<string, MaterialAmostra>();

function _rebuildIndexes() {
  _byId.clear();
  _byNomeUpper.clear();
  _bySiglaUpper.clear();
  for (const m of _cache) {
    _byId.set(m.id, m);
    if (m.nome) _byNomeUpper.set(m.nome.toUpperCase().trim(), m);
    if (m.sigla) _bySiglaUpper.set(m.sigla.toUpperCase().trim(), m);
  }
}


export interface MaterialAmostra {
  id: string;
  nome: string;
  sigla: string;
  diasRetencao: number;
  horasValidade: number;
  temperaturaRecomendada: string;
  reutilizavel: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialAmostraInput {
  nome: string;
  sigla?: string;
  diasRetencao?: number;
  horasValidade?: number;
  temperaturaRecomendada?: string;
  reutilizavel?: boolean;
  ativo?: boolean;
}

function rowToMaterial(r: any): MaterialAmostra {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    sigla: String(r.sigla ?? ""),
    diasRetencao: Number(r.dias_retencao ?? 0),
    horasValidade: Number(r.horas_validade ?? 0),
    temperaturaRecomendada: String(r.temperatura_recomendada ?? ""),
    reutilizavel: !!r.reutilizavel,
    ativo: !!r.ativo,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function listarMateriaisAmostra(opts: {
  ativosOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ rows: MaterialAmostra[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("materiais_amostra")
    .select("id, nome, sigla, dias_retencao, horas_validade, temperatura_recomendada, reutilizavel, ativo, created_at, updated_at", { count: "exact" })
    .order("nome", { ascending: true })
    .range(from, to);

  if (opts.ativosOnly) q = q.eq("ativo", true);
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`nome.ilike.%${s}%,sigla.ilike.%${s}%`);
  }

  const { data, count, error } = await q;
  if (error) {
    showError(error, { scope: "materiaisAmostraStore.listar", silent: true });
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []).map(rowToMaterial), total: count ?? 0 };
}

export async function criarMaterialAmostra(input: MaterialAmostraInput): Promise<MaterialAmostra | null> {
  const nome = (input.nome ?? "").trim();
  if (!nome) {
    showError(new Error("Nome do material é obrigatório."), { scope: "materiaisAmostraStore.criar" });
    return null;
  }
  const { data, error } = await supabase
    .from("materiais_amostra")
    .insert({
      nome,
      sigla: (input.sigla ?? "").trim().toUpperCase(),
      dias_retencao: Math.max(0, Number(input.diasRetencao ?? 0)),
      horas_validade: Math.max(0, Number(input.horasValidade ?? 0)),
      temperatura_recomendada: (input.temperaturaRecomendada ?? "").trim(),
      reutilizavel: !!input.reutilizavel,
      ativo: input.ativo ?? true,
    } as any)
    .select("*")
    .single();
  if (error) {
    showError(error, { scope: "materiaisAmostraStore.criar" });
    return null;
  }
  return rowToMaterial(data);
}

export async function atualizarMaterialAmostra(id: string, patch: Partial<MaterialAmostraInput>): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (patch.nome !== undefined) update.nome = patch.nome.trim();
  if (patch.sigla !== undefined) update.sigla = patch.sigla.trim().toUpperCase();
  if (patch.diasRetencao !== undefined) update.dias_retencao = Math.max(0, Number(patch.diasRetencao));
  if (patch.horasValidade !== undefined) update.horas_validade = Math.max(0, Number(patch.horasValidade));
  if (patch.temperaturaRecomendada !== undefined) update.temperatura_recomendada = patch.temperaturaRecomendada.trim();
  if (patch.reutilizavel !== undefined) update.reutilizavel = !!patch.reutilizavel;
  if (patch.ativo !== undefined) update.ativo = !!patch.ativo;

  const { error } = await supabase.from("materiais_amostra").update(update as any).eq("id", id);
  if (error) {
    showError(error, { scope: "materiaisAmostraStore.atualizar" });
    return false;
  }
  return true;
}

export async function removerMaterialAmostra(id: string): Promise<boolean> {
  const { error } = await supabase.from("materiais_amostra").delete().eq("id", id);
  if (error) {
    showError(error, { scope: "materiaisAmostraStore.remover" });
    return false;
  }
  return true;
}

// ─── Boot / sync resolver API (Exames 2.3) ───────────────────────────────

export async function _initMateriaisAmostraStore(): Promise<void> {
  const { data, error } = await supabase
    .from("materiais_amostra")
    .select("id, nome, sigla, dias_retencao, horas_validade, temperatura_recomendada, reutilizavel, ativo, created_at, updated_at")
    .order("nome", { ascending: true });
  if (error) {
    showError(error, { scope: "materiaisAmostraStore.init", silent: true });
    return;
  }
  _cache = (data ?? []).map(rowToMaterial);
  _rebuildIndexes();
}

/** Lista síncrona do cache (todos os materiais, ativos e inativos). */
export function getMateriaisAmostraSync(): MaterialAmostra[] {
  return _cache;
}

/** Lista síncrona de materiais ativos (uso em <Select>). */
export function getMateriaisAmostraAtivosSync(): MaterialAmostra[] {
  return _cache.filter((m) => m.ativo);
}

export function getMaterialById(id: string | null | undefined): MaterialAmostra | undefined {
  if (!id) return undefined;
  return _byId.get(id);
}

/** Resolve o nome legível do material para UI/etiquetas. Retorna "" quando não encontrado. */
export function resolveMaterialNome(id: string | null | undefined): string {
  if (!id) return "";
  return _byId.get(id)?.nome ?? "";
}

/** Resolve sigla curta (uso em etiquetas compactas). */
export function resolveMaterialSigla(id: string | null | undefined): string {
  if (!id) return "";
  return _byId.get(id)?.sigla ?? "";
}

/** Resolve id pelo nome (case-insensitive). Útil para presets/importação legada. */
export function resolveMaterialIdByNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const k = nome.toUpperCase().trim();
  return _byNomeUpper.get(k)?.id ?? null;
}

/** Resolve id pela sigla (case-insensitive). Usado por presets de setor. */
export function resolveMaterialIdBySigla(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  const k = sigla.toUpperCase().trim();
  return _bySiglaUpper.get(k)?.id ?? null;
}

