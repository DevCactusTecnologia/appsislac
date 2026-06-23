/**
 * Soroteca 2.0 — Fase 2: Estrutura Física
 *
 * Store enxuto para CRUD da hierarquia: Local → Galeria → Posição.
 *
 * Princípios:
 *  - tenant_id é resolvido por RLS no banco — frontend nunca envia.
 *  - Não duplica nada do `sorotecaStore` (amostras continuam lá).
 *  - Alocações ficam isoladas em funções de domínio (alocarAmostra/retirarAmostra),
 *    consumidas pela Fase 3 (Triagem).
 */

import { supabase } from "@/integrations/supabase/client";
import { persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type LocalTipo = "geladeira" | "freezer" | "armario" | "sala" | "outro";

export interface LocalArmazenamento {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: LocalTipo;
  temperatura_min: number | null;
  temperatura_max: number | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Galeria {
  id: string;
  tenant_id: string;
  local_id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PosicaoGaleria {
  id: string;
  tenant_id: string;
  galeria_id: string;
  codigo: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AmostraAlocacao {
  id: string;
  tenant_id: string;
  amostra_id: string;
  posicao_id: string;
  alocada_em: string;
  retirada_em: string | null;
  motivo_retirada: string | null;
  usuario_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- helpers ----------

async function resolveTenantId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  return profile?.tenant_id ?? null;
}

// ---------- locais ----------

export async function listarLocais(): Promise<LocalArmazenamento[]> {
  const { data, error } = await supabase
    .from("locais_armazenamento")
    .select("*")
    .order("nome");
  if (error) {
    showError(error, { scope: "soroteca.estrutura.listarLocais", silent: true });
    return [];
  }
  return (data ?? []) as LocalArmazenamento[];
}

export async function criarLocal(input: {
  nome: string;
  tipo: LocalTipo;
  temperatura_min?: number | null;
  temperatura_max?: number | null;
  observacao?: string | null;
}): Promise<{ ok: boolean; local?: LocalArmazenamento; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, error: "no-tenant" };
  try {
    const row = await persistOneOrThrow<LocalArmazenamento>(
      supabase.from("locais_armazenamento").insert({
        tenant_id,
        nome: input.nome.trim(),
        tipo: input.tipo,
        temperatura_min: input.temperatura_min ?? null,
        temperatura_max: input.temperatura_max ?? null,
        observacao: input.observacao ?? null,
      }),
      "soroteca.estrutura.criarLocal",
    );
    return { ok: true, local: row };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}


export async function atualizarLocal(
  id: string,
  input: {
    nome?: string;
    tipo?: LocalTipo;
    temperatura_min?: number | null;
    temperatura_max?: number | null;
    observacao?: string | null;
    ativo?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = {};
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.tipo !== undefined) patch.tipo = input.tipo;
  if (input.temperatura_min !== undefined) patch.temperatura_min = input.temperatura_min;
  if (input.temperatura_max !== undefined) patch.temperatura_max = input.temperatura_max;
  if (input.observacao !== undefined) patch.observacao = input.observacao;
  if (input.ativo !== undefined) patch.ativo = input.ativo;
  const { error } = await supabase.from("locais_armazenamento").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removerLocal(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("locais_armazenamento").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ---------- galerias ----------

export async function listarGalerias(localId?: string): Promise<Galeria[]> {
  let q = supabase.from("galerias").select("*").order("ordem").order("nome");
  if (localId) q = q.eq("local_id", localId);
  const { data, error } = await q;
  if (error) {
    showError(error, { scope: "soroteca.estrutura.listarGalerias", silent: true });
    return [];
  }
  return (data ?? []) as Galeria[];
}

export async function criarGaleria(input: {
  local_id: string;
  nome: string;
  ordem?: number;
}): Promise<{ ok: boolean; galeria?: Galeria; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, error: "no-tenant" };
  try {
    const row = await persistOneOrThrow<Galeria>(
      supabase.from("galerias").insert({
        tenant_id,
        local_id: input.local_id,
        nome: input.nome.trim(),
        ordem: input.ordem ?? 0,
      }),
      "soroteca.estrutura.criarGaleria",
    );
    return { ok: true, galeria: row };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}


export async function removerGaleria(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("galerias").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- posições ----------

export async function listarPosicoes(galeriaId?: string): Promise<PosicaoGaleria[]> {
  let q = supabase.from("posicoes_galeria").select("*").order("ordem").order("codigo");
  if (galeriaId) q = q.eq("galeria_id", galeriaId);
  const { data, error } = await q;
  if (error) {
    showError(error, { scope: "soroteca.estrutura.listarPosicoes", silent: true });
    return [];
  }
  return (data ?? []) as PosicaoGaleria[];
}

export async function criarPosicao(input: {
  galeria_id: string;
  codigo: string;
  ordem?: number;
}): Promise<{ ok: boolean; posicao?: PosicaoGaleria; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, error: "no-tenant" };
  try {
    const row = await persistOneOrThrow<PosicaoGaleria>(
      supabase.from("posicoes_galeria").insert({
        tenant_id,
        galeria_id: input.galeria_id,
        codigo: input.codigo.trim(),
        ordem: input.ordem ?? 0,
      }),
      "soroteca.estrutura.criarPosicao",
    );
    return { ok: true, posicao: row };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Cria várias posições de uma vez (geração em lote por padrão simples: A1..AN ou 1..N).
 */
export async function criarPosicoesEmLote(input: {
  galeria_id: string;
  prefixo?: string;
  inicio: number;
  fim: number;
}): Promise<{ ok: boolean; total: number; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, total: 0, error: "no-tenant" };
  if (input.fim < input.inicio) return { ok: false, total: 0, error: "intervalo inválido" };
  const rows = [];
  for (let i = input.inicio; i <= input.fim; i++) {
    rows.push({
      tenant_id,
      galeria_id: input.galeria_id,
      codigo: `${input.prefixo ?? ""}${i}`,
      ordem: i,
    });
  }
  const { error } = await supabase.from("posicoes_galeria").insert(rows);
  if (error) return { ok: false, total: 0, error: error.message };
  return { ok: true, total: rows.length };
}


export async function removerPosicao(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("posicoes_galeria").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- alocações (para uso da Fase 3 — Triagem) ----------

/**
 * Busca a próxima posição livre da galeria (ou do local inteiro).
 * Considera livre quando NÃO existe alocação ativa (retirada_em IS NULL).
 */
export async function proximaPosicaoLivre(filtro: {
  galeria_id?: string;
  local_id?: string;
}): Promise<PosicaoGaleria | null> {
  // Busca posições ativas no escopo desejado
  let q = supabase
    .from("posicoes_galeria")
    .select("*, galerias!inner(id, local_id)")
    .eq("ativo", true);
  if (filtro.galeria_id) q = q.eq("galeria_id", filtro.galeria_id);
  if (filtro.local_id) q = q.eq("galerias.local_id", filtro.local_id);
  const { data, error } = await q.order("ordem").order("codigo");
  if (error || !data) return null;
  const ids = data.map((p) => p.id);
  if (ids.length === 0) return null;
  const { data: ocupadas } = await supabase
    .from("amostra_alocacoes")
    .select("posicao_id")
    .is("retirada_em", null)
    .in("posicao_id", ids);
  const ocupadasSet = new Set((ocupadas ?? []).map((o) => o.posicao_id));
  const livre = data.find((p) => !ocupadasSet.has(p.id));
  return (livre ?? null) as PosicaoGaleria | null;
}

export async function alocarAmostra(input: {
  amostra_id: string;
  posicao_id: string;
  observacao?: string;
}): Promise<{ ok: boolean; alocacao?: AmostraAlocacao; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, error: "no-tenant" };
  const { data: userData } = await supabase.auth.getUser();
  try {
    const row = await persistOneOrThrow<AmostraAlocacao>(
      supabase.from("amostra_alocacoes").insert({
        tenant_id,
        amostra_id: input.amostra_id,
        posicao_id: input.posicao_id,
        usuario_id: userData?.user?.id ?? null,
        observacao: input.observacao ?? null,
      }),
      "soroteca.estrutura.alocarAmostra",
    );
    return { ok: true, alocacao: row };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function retirarAmostra(input: {
  alocacao_id: string;
  motivo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOneOrThrow(
      supabase
        .from("amostra_alocacoes")
        .update({
          retirada_em: new Date().toISOString(),
          motivo_retirada: input.motivo,
        })
        .eq("id", input.alocacao_id)
        .is("retirada_em", null),
      "soroteca.estrutura.retirarAmostra",
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- helpers para a Triagem (Fase 3) ----------

export interface AmostraTriagem {
  id: string;
  codigo_barra: string;
  tipo_material: string;
  data_coleta: string;
  status: string;
  paciente_id: number | null;
  atendimento_id: number | null;
}

/** Busca uma única amostra por código de barras / etiqueta. */
export async function buscarAmostraPorCodigo(
  codigo: string,
): Promise<AmostraTriagem | null> {
  const v = codigo.trim();
  if (!v) return null;
  const { data, error } = await supabase
    .from("amostras")
    .select("id, codigo_barra, tipo_material, data_coleta, status, paciente_id, atendimento_id")
    .eq("codigo_barra", v)
    .maybeSingle();
  if (error || !data) return null;
  return data as AmostraTriagem;
}

/** Alocação ativa atual da amostra (null se está pendente). */
export async function getAlocacaoAtiva(
  amostra_id: string,
): Promise<AmostraAlocacao | null> {
  const { data } = await supabase
    .from("amostra_alocacoes")
    .select("*")
    .eq("amostra_id", amostra_id)
    .is("retirada_em", null)
    .maybeSingle();
  return (data as AmostraAlocacao) ?? null;
}

export interface PosicaoCaminho {
  posicao_id: string;
  posicao_codigo: string;
  galeria_id: string;
  galeria_nome: string;
  local_id: string;
  local_nome: string;
}

/** Caminho legível "Local > Galeria > Posição". */
export async function getPosicaoCaminho(
  posicao_id: string,
): Promise<PosicaoCaminho | null> {
  const { data } = await supabase
    .from("posicoes_galeria")
    .select("id, codigo, galeria_id, galerias!inner(id, nome, local_id, locais_armazenamento!inner(id, nome))")
    .eq("id", posicao_id)
    .maybeSingle();
  if (!data) return null;
  const g = (data as unknown as {
    galerias: { id: string; nome: string; local_id: string; locais_armazenamento: { id: string; nome: string } };
  }).galerias;
  return {
    posicao_id: data.id,
    posicao_codigo: data.codigo,
    galeria_id: g.id,
    galeria_nome: g.nome,
    local_id: g.local_id,
    local_nome: g.locais_armazenamento.nome,
  };
}

/**
 * Conta amostras DISPONÍVEIS sem alocação ativa (pendentes de armazenamento).
 * Implementação simples: subtrai contagem alocadas do total disponível.
 */
export async function contarPendentesArmazenamento(): Promise<number> {
  const { count: totalDisp } = await supabase
    .from("amostras")
    .select("id", { count: "exact", head: true })
    .eq("status", "DISPONIVEL");
  const { data: ativas } = await supabase
    .from("amostra_alocacoes")
    .select("amostra_id, amostras!inner(status)")
    .is("retirada_em", null)
    .eq("amostras.status", "DISPONIVEL");
  const alocadas = new Set((ativas ?? []).map((a) => a.amostra_id)).size;
  return Math.max(0, (totalDisp ?? 0) - alocadas);
}
