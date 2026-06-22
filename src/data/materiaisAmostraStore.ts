// Catálogo canônico de materiais laboratoriais (Soroteca 2.0 — Fase 4).
//
// Fonte única de verdade. O campo legado `amostras.tipo_material` é
// mantido por compatibilidade e sincronizado automaticamente via trigger
// `sync_amostra_tipo_material` quando `material_id` é informado.
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

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
