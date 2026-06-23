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
  const patch: {
    nome?: string;
    tipo?: LocalTipo;
    temperatura_min?: number | null;
    temperatura_max?: number | null;
    observacao?: string | null;
    ativo?: boolean;
  } = {};
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


export async function atualizarGaleria(
  id: string,
  input: { nome?: string; ordem?: number; ativo?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const patch: { nome?: string; ordem?: number; ativo?: boolean } = {};
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.ordem !== undefined) patch.ordem = input.ordem;
  if (input.ativo !== undefined) patch.ativo = input.ativo;
  const { error } = await supabase.from("galerias").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removerGaleria(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("galerias").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- posições ----------

/** Visão enriquecida (posição + alocação ativa + paciente + protocolo + prazo de expurgo). */
export type PosicaoStatus = "livre" | "ocupada" | "vencendo" | "vencida" | "inativa";

export interface PosicaoEnriquecida {
  posicao: PosicaoGaleria;
  status: PosicaoStatus;
  amostra?: {
    id: string;
    codigo_barra: string;
    tipo_material: string;
    data_coleta: string;
    paciente_nome: string | null;
    protocolo: string | null;
    data_alocacao: string;
    data_expurgo: string | null; // estimada (alocada_em + retencao_dias do material)
    dias_para_expurgo: number | null;
  };
}

export async function listarPosicoesComOcupacao(galeriaId: string): Promise<PosicaoEnriquecida[]> {
  const posicoes = await listarPosicoes(galeriaId);
  if (posicoes.length === 0) return [];
  const ids = posicoes.map((p) => p.id);
  const { data: alocs } = await supabase
    .from("amostra_alocacoes")
    .select(
      "id, posicao_id, alocada_em, amostra_id, amostras!inner(id, codigo_barra, tipo_material, data_coleta, atendimento_id)",
    )
    .is("retirada_em", null)
    .in("posicao_id", ids);

  const alocList = (alocs ?? []) as Array<{
    posicao_id: string;
    alocada_em: string;
    amostras: {
      id: string;
      codigo_barra: string;
      tipo_material: string;
      data_coleta: string;
      atendimento_id: number | null;
    };
  }>;

  // Materiais — retencao_dias por nome.
  const materiais = Array.from(new Set(alocList.map((a) => a.amostras.tipo_material).filter(Boolean)));
  const retencaoMap: Record<string, number | null> = {};
  if (materiais.length > 0) {
    const { data: mats } = await supabase
      .from("materiais_amostra")
      .select("nome, dias_retencao")
      .in("nome", materiais);
    for (const m of (mats ?? []) as Array<{ nome: string; dias_retencao: number | null }>) {
      retencaoMap[m.nome] = m.dias_retencao;
    }
  }

  // Atendimentos -> paciente_nome + protocolo.
  const atendIds = Array.from(
    new Set(alocList.map((a) => a.amostras.atendimento_id).filter((v): v is number => v != null)),
  );
  const atendMap: Record<number, { paciente_nome: string | null; protocolo: string | null }> = {};
  if (atendIds.length > 0) {
    const { data: atends } = await supabase
      .from("atendimentos")
      .select("id, protocolo, paciente_nome")
      .in("id", atendIds);
    for (const a of atends ?? []) {
      const row = a as { id: number; protocolo: string | null; paciente_nome: string | null };
      atendMap[row.id] = { paciente_nome: row.paciente_nome, protocolo: row.protocolo };
    }
  }

  const byPos = new Map<string, (typeof alocList)[number]>();
  for (const a of alocList) byPos.set(a.posicao_id, a);

  const now = Date.now();
  return posicoes.map((p) => {
    if (!p.ativo) return { posicao: p, status: "inativa" as const };
    const a = byPos.get(p.id);
    if (!a) return { posicao: p, status: "livre" as const };
    const at = a.amostras.atendimento_id != null ? atendMap[a.amostras.atendimento_id] : undefined;
    const ret = retencaoMap[a.amostras.tipo_material] ?? null;
    let dataExpurgo: string | null = null;
    let dias: number | null = null;
    let status: PosicaoStatus = "ocupada";
    if (ret != null && ret > 0) {
      const exp = new Date(a.alocada_em);
      exp.setDate(exp.getDate() + ret);
      dataExpurgo = exp.toISOString();
      dias = Math.ceil((exp.getTime() - now) / (1000 * 60 * 60 * 24));
      if (dias < 0) status = "vencida";
      else if (dias <= 7) status = "vencendo";
    }
    return {
      posicao: p,
      status,
      amostra: {
        id: a.amostras.id,
        codigo_barra: a.amostras.codigo_barra,
        tipo_material: a.amostras.tipo_material,
        data_coleta: a.amostras.data_coleta,
        paciente_nome: at?.paciente_nome ?? null,
        protocolo: at?.protocolo ?? null,
        data_alocacao: a.alocada_em,
        data_expurgo: dataExpurgo,
        dias_para_expurgo: dias,
      },
    };
  });
}

/** Ocupação por local (somatório de posições ativas vs. ocupadas). */
export interface OcupacaoLocal {
  local_id: string;
  total: number;
  ocupadas: number;
  pct: number;
}
export async function ocupacaoPorLocal(): Promise<Record<string, OcupacaoLocal>> {
  const { data: pos } = await supabase
    .from("posicoes_galeria")
    .select("id, galeria_id, ativo, galerias!inner(local_id)")
    .eq("ativo", true);
  type Row = { id: string; galerias: { local_id: string } };
  const rows = (pos ?? []) as unknown as Row[];
  if (rows.length === 0) return {};
  const byLocal: Record<string, { total: number; ids: string[] }> = {};
  for (const r of rows) {
    const lid = r.galerias.local_id;
    if (!byLocal[lid]) byLocal[lid] = { total: 0, ids: [] };
    byLocal[lid].total++;
    byLocal[lid].ids.push(r.id);
  }
  const allIds = rows.map((r) => r.id);
  const { data: alocs } = await supabase
    .from("amostra_alocacoes")
    .select("posicao_id")
    .is("retirada_em", null)
    .in("posicao_id", allIds);
  const ocupadas = new Set((alocs ?? []).map((a) => (a as { posicao_id: string }).posicao_id));
  const out: Record<string, OcupacaoLocal> = {};
  for (const [lid, v] of Object.entries(byLocal)) {
    const oc = v.ids.filter((id) => ocupadas.has(id)).length;
    out[lid] = { local_id: lid, total: v.total, ocupadas: oc, pct: v.total ? (oc / v.total) * 100 : 0 };
  }
  return out;
}

/** Criação em grid 2D (linhas A..Z × colunas 1..N). */
export async function criarPosicoesGrid2D(input: {
  galeria_id: string;
  linhas: number; // 1..26
  colunas: number; // 1..99
}): Promise<{ ok: boolean; total: number; error?: string }> {
  const tenant_id = await resolveTenantId();
  if (!tenant_id) return { ok: false, total: 0, error: "no-tenant" };
  if (input.linhas < 1 || input.linhas > 26 || input.colunas < 1 || input.colunas > 99) {
    return { ok: false, total: 0, error: "dimensões inválidas" };
  }
  const rows = [];
  for (let l = 0; l < input.linhas; l++) {
    const letra = String.fromCharCode(65 + l);
    for (let c = 1; c <= input.colunas; c++) {
      rows.push({
        tenant_id,
        galeria_id: input.galeria_id,
        codigo: `${letra}${c}`,
        ordem: (l + 1) * 100 + c,
      });
    }
  }
  const { error } = await supabase.from("posicoes_galeria").insert(rows);
  if (error) return { ok: false, total: 0, error: error.message };
  return { ok: true, total: rows.length };
}


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


export async function atualizarPosicao(
  id: string,
  input: { codigo?: string; ordem?: number; ativo?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const patch: { codigo?: string; ordem?: number; ativo?: boolean } = {};
  if (input.codigo !== undefined) patch.codigo = input.codigo.trim();
  if (input.ordem !== undefined) patch.ordem = input.ordem;
  if (input.ativo !== undefined) patch.ativo = input.ativo;
  const { error } = await supabase.from("posicoes_galeria").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

// =================================================================
// Movimentações entre posições + IA de reorganização
// =================================================================

export interface MovimentacaoRow {
  id: string;
  amostra_id: string;
  posicao_origem_id: string | null;
  posicao_destino_id: string;
  caminho_origem: string | null;
  caminho_destino: string | null;
  motivo: string;
  lote_id: string | null;
  desfeita: boolean;
  desfeita_em: string | null;
  executada_por: string | null;
  executada_por_nome?: string | null;
  amostra_codigo?: string | null;
  paciente_nome?: string | null;
  created_at: string;
}

export type CompatibilidadeAviso =
  | { ok: true }
  | { ok: false; severidade: "bloqueio" | "aviso"; codigo: string; mensagem: string };

export async function validarCompatibilidade(
  amostraId: string,
  destinoId: string,
): Promise<CompatibilidadeAviso> {
  const { data: am } = await supabase
    .from("amostras")
    .select("tipo_material")
    .eq("id", amostraId)
    .maybeSingle();
  if (!am) return { ok: false, severidade: "bloqueio", codigo: "amostra_inexistente", mensagem: "Amostra não encontrada." };

  const { data: pos } = await supabase
    .from("posicoes_galeria")
    .select("id, ativo, galerias!inner(local_id, locais_armazenamento!inner(nome, temperatura_min, temperatura_max))")
    .eq("id", destinoId)
    .maybeSingle();
  if (!pos) return { ok: false, severidade: "bloqueio", codigo: "posicao_inexistente", mensagem: "Posição não encontrada." };
  if (!pos.ativo) return { ok: false, severidade: "bloqueio", codigo: "posicao_inativa", mensagem: "Posição está inativa." };

  const local = (pos as unknown as { galerias: { locais_armazenamento: { nome: string; temperatura_min: number | null; temperatura_max: number | null } } }).galerias.locais_armazenamento;
  const { data: mat } = await supabase
    .from("materiais_amostra")
    .select("temperatura_recomendada")
    .eq("nome", am.tipo_material)
    .maybeSingle();
  const rec = (mat?.temperatura_recomendada || "").toLowerCase();
  if (!rec || local.temperatura_min == null || local.temperatura_max == null) return { ok: true };

  let faixaOk = true;
  if (rec.includes("ambiente")) faixaOk = local.temperatura_max >= 15 && local.temperatura_min <= 30;
  else if (rec.includes("refriger") || rec.includes("2-8") || rec.includes("2 a 8")) faixaOk = local.temperatura_min >= 2 && local.temperatura_max <= 10;
  else if (rec.includes("-20") || rec.includes("congel")) faixaOk = local.temperatura_max <= -15;
  else if (rec.includes("-80") || rec.includes("ultra")) faixaOk = local.temperatura_max <= -70;

  if (!faixaOk) {
    return {
      ok: false,
      severidade: "aviso",
      codigo: "temperatura_incompativel",
      mensagem: `Temperatura recomendada (${mat?.temperatura_recomendada}) não bate com o local "${local.nome}" (${local.temperatura_min}°C a ${local.temperatura_max}°C).`,
    };
  }
  return { ok: true };
}

export async function moverAmostra(input: {
  amostra_id: string;
  destino_id: string;
  motivo?: string;
  lote_id?: string;
  observacao?: string;
}): Promise<{ ok: true; mov_id: string } | { ok: false; error: string; codigo?: string }> {
  const { data, error } = await supabase.rpc("mover_amostra", {
    p_amostra: input.amostra_id,
    p_destino: input.destino_id,
    p_motivo: input.motivo ?? "manual",
    p_lote: input.lote_id ?? null,
    p_observacao: input.observacao ?? null,
  });
  if (error) {
    const m = error.message.match(/(posicao_ocupada|posicao_inativa|posicao_inexistente|posicao_igual_atual|tenant_nao_resolvido)/);
    return { ok: false, error: error.message, codigo: m?.[0] };
  }
  return { ok: true, mov_id: data as string };
}

export async function desfazerMovimentacao(movId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("desfazer_movimentacao", { p_mov: movId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listarMovimentacoes(filtro: {
  galeria_id?: string;
  amostra_id?: string;
  limite?: number;
}): Promise<MovimentacaoRow[]> {
  let q = supabase
    .from("amostra_movimentacoes")
    .select("id, amostra_id, posicao_origem_id, posicao_destino_id, caminho_origem, caminho_destino, motivo, lote_id, desfeita, desfeita_em, executada_por, created_at")
    .order("created_at", { ascending: false })
    .limit(filtro.limite ?? 100);
  if (filtro.amostra_id) q = q.eq("amostra_id", filtro.amostra_id);
  const { data, error } = await q;
  if (error || !data) return [];
  let rows = data as MovimentacaoRow[];

  if (filtro.galeria_id) {
    const { data: posIds } = await supabase
      .from("posicoes_galeria")
      .select("id")
      .eq("galeria_id", filtro.galeria_id);
    const set = new Set((posIds ?? []).map((p) => p.id as string));
    rows = rows.filter((r) => set.has(r.posicao_destino_id) || (r.posicao_origem_id != null && set.has(r.posicao_origem_id)));
  }

  const userIds = Array.from(new Set(rows.map((r) => r.executada_por).filter((v): v is string => !!v)));
  const amostraIds = Array.from(new Set(rows.map((r) => r.amostra_id)));
  const [profs, ams] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("user_id, nome_completo, email").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; nome_completo: string | null; email: string | null }> }),
    amostraIds.length
      ? supabase.from("amostras").select("id, codigo_barra, atendimento_id").in("id", amostraIds)
      : Promise.resolve({ data: [] as Array<{ id: string; codigo_barra: string; atendimento_id: number | null }> }),
  ]);
  const profMap = new Map((profs.data ?? []).map((p) => [p.user_id, p.nome_completo || p.email]));
  const amMap = new Map((ams.data ?? []).map((a) => [a.id, a]));
  const atendIds = Array.from(new Set((ams.data ?? []).map((a) => a.atendimento_id).filter((v): v is number => v != null)));
  let pacMap = new Map<number, string | null>();
  if (atendIds.length) {
    const { data: ats } = await supabase
      .from("atendimentos")
      .select("id, paciente_nome")
      .in("id", atendIds);
    pacMap = new Map((ats ?? []).map((a) => [a.id as number, (a as { paciente_nome: string | null }).paciente_nome]));
  }
  return rows.map((r) => {
    const am = amMap.get(r.amostra_id);
    return {
      ...r,
      executada_por_nome: r.executada_por ? profMap.get(r.executada_por) ?? null : null,
      amostra_codigo: am?.codigo_barra ?? null,
      paciente_nome: am?.atendimento_id != null ? pacMap.get(am.atendimento_id) ?? null : null,
    };
  });
}

export interface PlanoReorganizacao {
  movimentacoes: Array<{
    amostra_id: string;
    amostra_codigo: string;
    paciente_nome: string | null;
    posicao_origem_id: string;
    posicao_origem_codigo: string;
    posicao_destino_id: string;
    posicao_destino_codigo: string;
    motivo: string;
  }>;
  resumo: string;
  ganho_estimado: string;
  fonte: "ia" | "fallback";
}

export async function sugerirReorganizacaoGaleria(galeriaId: string): Promise<{ ok: true; plano: PlanoReorganizacao } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("soroteca-reorganizar-galeria", {
    body: { galeria_id: galeriaId },
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string })?.error) return { ok: false, error: (data as { error: string }).error };
  return { ok: true, plano: data as PlanoReorganizacao };
}
