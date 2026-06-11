// Acesso à vitrine pública e captação de leads. Tudo aqui é seguro para
// chamada anônima — RLS no banco é a fonte da verdade.
import { supabase } from "@/integrations/supabase/client";

export interface VitrineSettings {
  tenant_id: string;
  exibir_exames: boolean;
  permitir_reserva: boolean;
  mostrar_preco: boolean;
  titulo_vitrine: string;
  descricao_vitrine: string;
  whatsapp_contato: string;
  tema: string;
  logo_url: string | null;
  favicon_url: string | null;
  /** Title da aba/SERP (até 70 chars). */
  seo_title?: string | null;
  /** Meta description (até 160 chars). */
  seo_description?: string | null;
  /** Imagem usada em compartilhamentos (Open Graph / Twitter Card). */
  og_image_url?: string | null;
  /** Imagem do hero (substitui a imagem fictícia padrão). */
  hero_image_url?: string | null;
  /** Imagem da seção "sobre". */
  sobre_image_url?: string | null;
  /** Mapa { resultados | coleta | unidades | exames -> url }. */
  servicos_images?: Record<string, string | null> | null;
  /** Mapa { matriz | shopping | clinica -> url }. */
  unidades_images?: Record<string, string | null> | null;
  /** Mapa { sobre | servicos | exames | convenios | unidades | depoimentos -> boolean }.
   *  Controla a exibição de cada seção da landing. Quando ausente, todas são exibidas. */
  secoes_visiveis?: Record<string, boolean> | null;
  /**
   * IA-first governance: toggles centrais do fluxo Web → Atendimento.
   * Source of truth única — não duplicar essas flags em outras tabelas/telas.
   *  - permitir_compra_online: habilita checkout (modo COMPRAR na vitrine).
   *  - permitir_agendamento:   habilita reserva sem pagamento (modo AGENDAR).
   *  - exigir_aprovacao_manual: solicitações ficam em "aguardando aprovação"
   *    antes de virar atendimento (mesmo se pagas).
   *  - auto_criar_atendimento: quando o pagamento é confirmado pelo gateway,
   *    o atendimento é criado automaticamente (origem WEB_AUTO).
   */
  permitir_compra_online?: boolean;
  permitir_agendamento?: boolean;
  exigir_aprovacao_manual?: boolean;
  auto_criar_atendimento?: boolean;
}

export interface ExamePublico {
  publico_id: string;
  tenant_id: string;
  exame_id: string;
  destaque: boolean;
  ordem: number;
  nome: string;
  categoria: string;
  material: string;
  preparo: string;
  requer_jejum: boolean;
  valor: number;
  /** COMPRAR | AGENDAR | INFORMAR. Default 'INFORMAR' (apenas catálogo). */
  modo_publicacao?: "COMPRAR" | "AGENDAR" | "INFORMAR";
}

export interface NovaSolicitacao {
  tenant_id: string;
  nome: string;
  telefone: string;
  cpf?: string | null;
  observacao?: string;
  exames: Array<{ exame_id: string; nome: string; valor: number }>;
  total_estimado: number;
  tipo_atendimento?: "laboratorio" | "domiciliar";
  unidade_id?: string | null;
}

/** Lê configurações da vitrine pública do tenant. Anônimo pode chamar. */
export async function getVitrineSettings(tenantId: string): Promise<VitrineSettings | null> {
  const { data } = await supabase
    .from("tenant_settings_public" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as VitrineSettings | null) ?? null;
}

/** Lista exames públicos do tenant (anônimo). */
export async function listExamesPublicos(tenantId: string, opts?: { destaque?: boolean; limite?: number }): Promise<ExamePublico[]> {
  let q = supabase
    .from("exames_publicos_view" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (opts?.destaque) q = q.eq("destaque", true);
  if (opts?.limite && opts.limite > 0) q = q.limit(opts.limite);
  const { data } = await q;
  return ((data as ExamePublico[] | null) ?? []);
}

/** Insere uma solicitação pública (lead). Validação ocorre no trigger do banco. */
export async function submitSolicitacaoPublica(input: NovaSolicitacao): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    tenant_id: input.tenant_id,
    nome: input.nome.trim().slice(0, 120),
    telefone: input.telefone.replace(/\D/g, "").slice(0, 15),
    cpf: input.cpf ? input.cpf.replace(/\D/g, "").slice(0, 11) : null,
    observacao: (input.observacao ?? "").slice(0, 1000),
    exames: input.exames,
    total_estimado: Number(input.total_estimado) || 0,
    tipo_atendimento: input.tipo_atendimento ?? "laboratorio",
    unidade_id: input.unidade_id ?? null,
  };
  const { error } = await supabase.from("solicitacoes_publicas" as never).insert(payload as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// =====================================================================
// Vitrine pública: unidades e lookup de paciente por CPF
// =====================================================================

export interface UnidadePublica {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: "SEDE" | "FILIAL" | "PONTO_DE_COLETA";
  endereco: string;
  cidade: string;
  estado: string;
  telefone: string;
}

export async function listUnidadesPublicas(tenantId: string): Promise<UnidadePublica[]> {
  const { data } = await supabase
    .from("unidades_publicas" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true });
  return ((data as UnidadePublica[] | null) ?? []);
}

export interface PacientePublicoLookup {
  nome: string;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  data_nascimento: string | null;
  sexo: string | null;
}

export async function lookupPacientePorCpf(
  tenantId: string,
  cpf: string,
): Promise<PacientePublicoLookup | null> {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  const { data } = await supabase.rpc("lookup_paciente_publico" as never, {
    p_tenant_id: tenantId,
    p_cpf: digits,
  } as never);
  const arr = (data as PacientePublicoLookup[] | null) ?? [];
  return arr[0] ?? null;
}

// =====================================================================
// Admin (autenticado): gestão de quais exames são públicos
// =====================================================================

export interface ExamePublicoAdmin {
  id: string;
  tenant_id: string;
  exame_id: string;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  modo_publicacao?: "COMPRAR" | "AGENDAR" | "INFORMAR";
}

export async function listExamesPublicosAdmin(tenantId: string): Promise<ExamePublicoAdmin[]> {
  const { data } = await supabase
    .from("exames_publicos" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("ordem", { ascending: true });
  return ((data as ExamePublicoAdmin[] | null) ?? []);
}

export async function upsertExamePublico(row: { tenant_id: string; exame_id: string; destaque?: boolean; ativo?: boolean; ordem?: number; modo_publicacao?: "COMPRAR" | "AGENDAR" | "INFORMAR" }): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("exames_publicos" as never)
    .upsert(row as never, { onConflict: "tenant_id,exame_id" } as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeExamePublico(tenantId: string, exameId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("exames_publicos" as never)
    .delete()
    .eq("tenant_id", tenantId)
    .eq("exame_id", exameId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function saveVitrineSettings(input: VitrineSettings): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("tenant_settings_public" as never)
    .upsert(input as never, { onConflict: "tenant_id" } as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function listSolicitacoesPublicas(tenantId: string): Promise<Array<{ id: string; tenant_id: string; nome: string; telefone: string; cpf: string | null; observacao: string; exames: unknown; total_estimado: number; status: string; created_at: string }>> {
  const { data } = await supabase
    .from("solicitacoes_publicas" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return ((data as Array<{ id: string; tenant_id: string; nome: string; telefone: string; cpf: string | null; observacao: string; exames: unknown; total_estimado: number; status: string; created_at: string }> | null) ?? []);
}

// =====================================================================
// Gestão de status / leitura / conversão / edição
// =====================================================================

export type SolicitacaoStatus = "NOVO" | "EM_CONTATO" | "CONVERTIDO" | "DESCARTADO";

export interface SolicitacaoFull {
  id: string;
  tenant_id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  observacao: string;
  exames: unknown;
  total_estimado: number;
  status: SolicitacaoStatus;
  lida: boolean;
  notas_internas: string;
  convertido_atendimento_id: string | null;
  convertido_em: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Campos de pagamento populados pelo webhook do gateway (Onda 3).
   * Por enquanto vêm sempre 'NONE' / null — apenas para badges sem\u00e2nticos.
   */
  payment_provider?: string | null;
  payment_intent_id?: string | null;
  payment_status?: "NONE" | "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUNDED";
  payment_paid_at?: string | null;
}

export async function listSolicitacoesFull(tenantId: string): Promise<SolicitacaoFull[]> {
  const { data } = await supabase
    .from("solicitacoes_publicas" as never)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return ((data as SolicitacaoFull[] | null) ?? []);
}

export async function updateSolicitacaoStatus(id: string, status: SolicitacaoStatus): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("solicitacoes_publicas" as never)
    .update({ status, lida: true } as never)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markSolicitacaoLida(id: string, lida = true): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("solicitacoes_publicas" as never)
    .update({ lida } as never)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateSolicitacaoContato(
  id: string,
  patch: { telefone?: string; cpf?: string | null; observacao?: string; notas_internas?: string }
): Promise<{ ok: boolean; error?: string }> {
  const clean: Record<string, unknown> = {};
  if (patch.telefone !== undefined) clean.telefone = patch.telefone.replace(/\D/g, "").slice(0, 15);
  if (patch.cpf !== undefined) clean.cpf = patch.cpf ? patch.cpf.replace(/\D/g, "").slice(0, 11) : null;
  if (patch.observacao !== undefined) clean.observacao = (patch.observacao ?? "").slice(0, 1000);
  if (patch.notas_internas !== undefined) clean.notas_internas = (patch.notas_internas ?? "").slice(0, 2000);
  const { error } = await supabase
    .from("solicitacoes_publicas" as never)
    .update(clean as never)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function marcarConvertido(id: string, atendimentoRef: string | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("solicitacoes_publicas" as never)
    .update({
      status: "CONVERTIDO",
      lida: true,
      convertido_atendimento_id: atendimentoRef,
      convertido_em: new Date().toISOString(),
    } as never)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function countSolicitacoesNaoLidas(tenantId: string): Promise<number> {
  const { count } = await supabase
    .from("solicitacoes_publicas" as never)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("lida", false);
  return count ?? 0;
}