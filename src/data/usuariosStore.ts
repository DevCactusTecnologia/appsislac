// Store síncrono de usuários (profiles + user_roles) seguindo o padrão dos
// demais stores baseados em Supabase (cache em memória + listeners).
//
// Diferente de outros stores, mutações privilegiadas (criar usuário, alterar
// perfil/permissões/status, gerenciar role admin, reset de senha) acontecem
// via edge functions admin-* que validam que o caller é admin.

import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export type Perfil = "admin" | "analista" | "recepcionista" | "financeiro";

export interface Usuario {
  /** UUID do auth.users */
  userId: string;
  /** ID amigável imutável (ex.: USR-000001) */
  nome: string;
  friendlyId?: string;
  email: string;
  perfil: Perfil;
  status: "Ativo" | "Inativo";
  /** Permissões EXTRAS concedidas (além das default do perfil) */
  permissoesExtras: string[];
  /** Permissões REVOGADAS (subtraem dos defaults do perfil) */
  permissoesRevogadas: string[];
  unidadeIds: string[];
  unidadeAtiva: string;
  avatar: string | null;
  /** Chave S3 do avatar (quando armazenado em S3). */
  avatarKey: string | null;
  /** True se possui role 'admin' em user_roles */
  isAdmin: boolean;
  createdAt: string;
  /** Assinatura no laudo: "carimbo" (texto gerado) ou "imagem" (scaneada no S3). */
  assinaturaTipo: "carimbo" | "imagem";
  /** Chave do objeto no S3 da imagem de assinatura (quando tipo=imagem). */
  assinaturaImagemKey: string | null;
  /** Conselho profissional exibido junto à assinatura (texto livre). */
  assinaturaConselho: string | null;
  /** Telefone do profissional. */
  telefone: string | null;
  /** Dados profissionais (especialmente para analistas). */
  tipoProfissional: string | null;
  cbo: string | null;
  cpf: string | null;
  cns: string | null;
  conselhoClasse: string | null;
  conselhoUf: string | null;
  conselhoNumero: string | null;
}

// === Catálogo de permissões reais (alinhado a public.has_permission) =========
export interface Permissao {
  id: string;
  label: string;
  descricao: string;
}

export interface GrupoPermissao {
  id: string;
  label: string;
  permissoes: Permissao[];
}

export const PERMISSOES_AGRUPADAS: GrupoPermissao[] = [
  {
    id: "atendimentos",
    label: "Atendimentos",
    permissoes: [
      { id: "visualizar_atendimentos", label: "Visualizar atendimentos", descricao: "Listar e abrir atendimentos" },
      { id: "criar_atendimento", label: "Criar atendimento", descricao: "Iniciar novos atendimentos" },
      { id: "editar_atendimento", label: "Editar atendimento", descricao: "Alterar atendimentos existentes" },
      { id: "cancelar_atendimento", label: "Cancelar atendimento", descricao: "Cancelar atendimentos e exames" },
      { id: "solicitacoes_site_acesso", label: "Pedidos do site", descricao: "Acessar pedidos vindos do site" },
    ],
  },
  {
    id: "rotina",
    label: "Rotina",
    permissoes: [
      { id: "registrar_coleta", label: "Coletas", descricao: "Registrar coletas de amostras" },
      { id: "analisar_amostra", label: "Análise", descricao: "Avançar exames para análise" },
      { id: "liberar_resultado", label: "Resultados", descricao: "Assinar e liberar laudos" },
      { id: "imprimir_laudo", label: "Imprimir laudo", descricao: "Gerar PDF/impressão de laudos" },
      { id: "gerenciar_soroteca", label: "Soroteca", descricao: "Gerenciar amostras na soroteca" },
      { id: "armazenar_amostra", label: "Armazenar amostra", descricao: "Alocar amostras em galerias/posições" },
    ],
  },
  {
    id: "resultados",
    label: "Resultados",
    permissoes: [
      { id: "consultar_resultados", label: "Consultar", descricao: "Acessar a página de consulta de resultados" },
      { id: "lab_apoio_acesso", label: "Apoio Laboratorial", descricao: "Acessar a página de Apoio Laboratorial" },
    ],
  },
  {
    id: "pacientes",
    label: "Pacientes & Especialistas",
    permissoes: [
      { id: "visualizar_pacientes", label: "Visualizar pacientes", descricao: "Listar e abrir cadastros" },
      { id: "cadastrar_paciente", label: "Cadastrar paciente", descricao: "Criar novos pacientes/especialistas" },
      { id: "editar_paciente", label: "Editar paciente", descricao: "Alterar cadastros existentes" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    permissoes: [
      { id: "visualizar_financeiro", label: "Visualizar financeiro", descricao: "Acessar entradas e saídas" },
      { id: "gestao_financeira", label: "Gestão financeira", descricao: "Criar/editar saídas" },
      { id: "registrar_pagamento", label: "Registrar pagamento", descricao: "Lançar pagamentos em atendimentos" },
      { id: "criar_orcamento", label: "Criar orçamento", descricao: "Emitir orçamentos" },
      { id: "visualizar_orcamentos", label: "Visualizar orçamentos", descricao: "Listar orçamentos" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações & Cadastros",
    permissoes: [
      { id: "configuracoes_sistema", label: "Configurações do sistema", descricao: "Acessar /configuracoes" },
      { id: "gestao_usuarios", label: "Gestão de usuários", descricao: "Painel de usuários e permissões" },
      { id: "gestao_unidades", label: "Gestão de unidades", descricao: "Sedes, filiais e pontos de coleta" },
      { id: "gestao_convenios", label: "Gestão de convênios", descricao: "Cadastro de convênios" },
      { id: "gestao_exames", label: "Gestão de exames", descricao: "Catálogo técnico de exames" },
      { id: "integracoes.gerenciar", label: "Integrações", descricao: "Configurar provedores de integração externa" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    permissoes: [
      { id: "visualizar_dashboard", label: "Dashboard", descricao: "Página inicial" },
      { id: "impressao_geral", label: "Impressão", descricao: "Relatório consolidado por unidade" },
      { id: "relatorios_producao", label: "Produção", descricao: "Relatório de produção" },
      { id: "relatorios_ocorrencias", label: "Ocorrências", descricao: "Relatório de ocorrências" },
      { id: "relatorios_recoletas", label: "Recoletas", descricao: "Relatório de recoletas" },
      { id: "visualizar_orcamentos", label: "Orçamentos", descricao: "Listar orçamentos" },
      { id: "mapa_trabalho_acesso", label: "Mapa", descricao: "Acessar o mapa de trabalho" },
      { id: "auditoria", label: "Auditoria", descricao: "Histórico de alterações" },
    ],
  },
];

export const TODAS_PERMISSOES: string[] = PERMISSOES_AGRUPADAS.flatMap((g) =>
  g.permissoes.map((p) => p.id),
);

// Defaults espelham public.has_permission no banco
export const DEFAULTS_POR_PERFIL: Record<Perfil, string[]> = {
  admin: TODAS_PERMISSOES,
  analista: [
    "visualizar_dashboard", "visualizar_pacientes", "visualizar_atendimentos",
    "analisar_amostra", "liberar_resultado", "imprimir_laudo", "registrar_coleta",
    "consultar_resultados", "lab_apoio_acesso", "mapa_trabalho_acesso",
  ],
  recepcionista: [
    "visualizar_dashboard", "cadastrar_paciente", "editar_paciente", "visualizar_pacientes",
    "criar_atendimento", "editar_atendimento", "visualizar_atendimentos",
    "registrar_coleta", "registrar_pagamento", "criar_orcamento", "visualizar_orcamentos",
    "consultar_resultados", "solicitacoes_site_acesso",
  ],
  financeiro: [
    "visualizar_dashboard", "visualizar_pacientes", "visualizar_atendimentos",
    "gestao_financeira", "registrar_pagamento", "visualizar_financeiro",
    "criar_orcamento", "visualizar_orcamentos",
    "consultar_resultados", "relatorios_producao",
  ],
};

export function resolverPermissoesEfetivas(u: Pick<Usuario, "perfil" | "permissoesExtras" | "permissoesRevogadas" | "isAdmin">): Set<string> {
  if (u.isAdmin) return new Set(TODAS_PERMISSOES);
  const set = new Set<string>(DEFAULTS_POR_PERFIL[u.perfil] ?? []);
  for (const e of u.permissoesExtras) set.add(e);
  for (const r of u.permissoesRevogadas) set.delete(r);
  return set;
}

// === Cache + listeners =======================================================
let _cache: Usuario[] = [];
let _listeners: Array<() => void> = [];
let _loaded = false;

interface DbProfile {
  user_id: string;
  friendly_id?: string;
  nome: string;
  email: string;
  perfil: Perfil;
  status: string;
  permissoes_extras: string[];
  permissoes_revogadas: string[];
  unidade_ids: string[];
  unidade_ativa: string;
  avatar: string | null;
  avatar_key?: string | null;
  created_at: string;
  assinatura_tipo?: string | null;
  assinatura_imagem_key?: string | null;
  assinatura_conselho?: string | null;
  telefone?: string | null;
  tipo_profissional?: string | null;
  cbo?: string | null;
  cpf?: string | null;
  cns?: string | null;
  conselho_classe?: string | null;
  conselho_uf?: string | null;
  conselho_numero?: string | null;
}

interface DbRole { user_id: string; role: string }

function mapToUsuario(p: DbProfile, roles: DbRole[]): Usuario {
  const userRoles = roles.filter((r) => r.user_id === p.user_id).map((r) => r.role);
  return {
    userId: p.user_id,
    friendlyId: p.friendly_id || "",
    nome: p.nome || p.email.split("@")[0],
    email: p.email,
    perfil: p.perfil,
    status: (p.status === "Inativo" ? "Inativo" : "Ativo") as "Ativo" | "Inativo",
    permissoesExtras: p.permissoes_extras ?? [],
    permissoesRevogadas: p.permissoes_revogadas ?? [],
    unidadeIds: p.unidade_ids?.length ? p.unidade_ids : ["und-001"],
    unidadeAtiva: p.unidade_ativa || "und-001",
    avatar: p.avatar,
    avatarKey: p.avatar_key ?? null,
    isAdmin: userRoles.includes("admin"),
    createdAt: p.created_at,
    assinaturaTipo: p.assinatura_tipo === "imagem" ? "imagem" : "carimbo",
    assinaturaImagemKey: p.assinatura_imagem_key ?? null,
    assinaturaConselho: p.assinatura_conselho ?? null,
    telefone: p.telefone ?? null,
    tipoProfissional: p.tipo_profissional ?? null,
    cbo: p.cbo ?? null,
    cpf: p.cpf ?? null,
    cns: p.cns ?? null,
    conselhoClasse: p.conselho_classe ?? null,
    conselhoUf: p.conselho_uf ?? null,
    conselhoNumero: p.conselho_numero ?? null,
  };
}

function notify() { _listeners.forEach((fn) => fn()); }

export async function _initUsuariosStore(): Promise<void> {
  // Best-effort: se o caller não for admin, RLS retorna apenas seu próprio profile.
  // O painel /usuarios só está acessível a quem tem permissão `gestao_usuarios`,
  // e na prática hoje só admins. RLS já bloqueia o resto.
  const [{ data: profiles, error: pErr }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("user_id,friendly_id,nome,email,perfil,status,permissoes_extras,permissoes_revogadas,unidade_ids,unidade_ativa,avatar,avatar_key,created_at,assinatura_tipo,assinatura_imagem_key,assinatura_conselho,telefone,tipo_profissional,cbo,cpf,cns,conselho_classe,conselho_uf,conselho_numero").order("created_at", { ascending: true }),
    supabase.from("user_roles").select("user_id,role"),
  ]);
  if (pErr) {
    showError(pErr, { scope: "usuariosStore.load", silent: true });
    _cache = [];
  } else {
    const allRoles = (roles as DbRole[] | null) ?? [];
    // ⚠ Boundary multi-tenant: Super Admin é membro da PLATAFORMA, não do tenant.
    // Defesa em profundidade — RLS já filtra, mas garantimos no cliente que
    // nenhum perfil de super_admin apareça em /equipe.
    const superAdminIds = new Set(
      allRoles.filter((r) => r.role === "super_admin").map((r) => r.user_id),
    );
    _cache = (profiles as DbProfile[] | null ?? [])
      .filter((p) => !superAdminIds.has(p.user_id))
      .map((p) => mapToUsuario(p, allRoles));
  }
  _loaded = true;
  notify();
}

export function isUsuariosLoaded() { return _loaded; }
// IMPORTANTE: retorna a MESMA referência enquanto `_cache` não muda.
// Necessário para `useSyncExternalStore` evitar loop infinito (React #185).
// Toda mutação reatribui `_cache` para uma nova array, então a igualdade
// referencial só falha quando os dados realmente mudaram.
export function getUsuarios(): Usuario[] { return _cache; }
export function getUsuarioById(userId: string): Usuario | undefined { return _cache.find((u) => u.userId === userId); }

export function subscribeUsuarios(listener: () => void): () => void {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}

// === Mutações via edge functions admin-* =====================================
export interface DadosProfissionais {
  telefone?: string;
  tipoProfissional?: string;
  cbo?: string;
  cpf?: string;
  cns?: string;
  conselhoClasse?: string;
  conselhoUf?: string;
  conselhoNumero?: string;
}

export interface InviteInput extends DadosProfissionais {
  email: string;
  nome: string;
  perfil: Perfil;
  unidadeIds: string[];
  permissoesExtras: string[];
  permissoesRevogadas: string[];
  isAdmin: boolean;
  /** Se preenchida, cria o usuário já com senha (sem envio de email de convite). */
  password?: string;
}

export async function inviteUsuario(input: InviteInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-invite-user", { body: input });
  if (error) {
    // FunctionsHttpError não expõe o body por padrão — tentamos extrair a mensagem real.
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = await ctx.json();
        if (parsed?.error) detail = String(parsed.error);
      }
    } catch { /* ignore */ }
    return { ok: false, error: detail };
  }
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error || "Falha ao convidar usuário." };
  await _initUsuariosStore();
  return { ok: true };
}


export interface UpdateInput extends DadosProfissionais {
  userId: string;
  nome?: string;
  perfil?: Perfil;
  status?: "Ativo" | "Inativo";
  unidadeIds?: string[];
  permissoesExtras?: string[];
  permissoesRevogadas?: string[];
  isAdmin?: boolean;
  /** Nova senha (opcional). Quando definida, redefine no Supabase Auth. */
  password?: string;
  assinaturaTipo?: "carimbo" | "imagem";
  assinaturaConselho?: string;
}

export async function updateUsuario(input: UpdateInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-update-user", { body: input });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error || "Falha ao atualizar usuário." };
  await _initUsuariosStore();
  return { ok: true };
}

export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteUsuario(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { userId } });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error || "Falha ao excluir usuário." };
  await _initUsuariosStore();
  return { ok: true };
}

// === Assinatura no laudo (upload S3 + URL assinada) =========================

export interface UploadAssinaturaInput {
  userId: string;
  filename: string;
  contentType: string;
  /** Conteúdo do arquivo em base64 (sem prefixo data:). */
  dataBase64: string;
}

export async function uploadAssinatura(
  input: UploadAssinaturaInput,
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("upload-assinatura", { body: input });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; key?: string; error?: string };
  if (!r?.ok) return { ok: false, error: r?.error || "Falha no upload" };
  await _initUsuariosStore();
  return { ok: true, key: r.key };
}

export async function removerAssinaturaImagem(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("upload-assinatura", {
    body: { userId, remove: true },
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string };
  if (!r?.ok) return { ok: false, error: r?.error || "Falha ao remover" };
  await _initUsuariosStore();
  return { ok: true };
}

export async function fetchAssinaturaUrl(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("assinatura-url", {
    body: { userId },
  });
  if (error) return null;
  const r = data as { ok?: boolean; url?: string | null };
  return r?.url ?? null;
}

// === Avatar (upload S3 + URL assinada) =====================================

export async function uploadAvatar(
  input: { contentType: string; dataBase64: string; filename?: string; targetUserId?: string },
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("upload-image", {
    body: { category: "avatar", ...input },
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; key?: string; error?: string };
  if (!r?.ok) return { ok: false, error: r?.error || "Falha no upload" };
  await _initUsuariosStore();
  return { ok: true, key: r.key };
}

export async function removerAvatar(targetUserId?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("upload-image", {
    body: { category: "avatar", remove: true, targetUserId },
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok?: boolean; error?: string };
  if (!r?.ok) return { ok: false, error: r?.error || "Falha ao remover" };
  await _initUsuariosStore();
  return { ok: true };
}

// Cache de URLs assinadas de avatar (in-memory). Resolvido sob demanda.
const _avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function fetchAvatarUrl(key: string): Promise<string | null> {
  if (!key) return null;
  const cached = _avatarUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.functions.invoke("image-url", { body: { key } });
  if (error) return null;
  const r = data as { ok?: boolean; url?: string | null };
  if (!r?.url) return null;
  _avatarUrlCache.set(key, { url: r.url, expiresAt: Date.now() + 50 * 60 * 1000 });
  return r.url;
}

// === Integridade tenant × user_roles =========================================
// Lista perfis operacionais com inconsistência (sem role em user_roles ou
// sem tenant vinculado). Apenas admin/super_admin recebem dados.
export interface UsuarioIntegridade {
  userId: string;
  email: string;
  nome: string;
  tenantId: string | null;
  hasRole: boolean;
  hasTenant: boolean;
  issue: string;
}

export async function fetchUsuariosIntegridade(): Promise<UsuarioIntegridade[]> {
  const { data, error } = await supabase.rpc("tenant_users_integrity");
  if (error || !data) return [];
  return (data as Array<{
    user_id: string; email: string; nome: string; tenant_id: string | null;
    has_role: boolean; has_tenant: boolean; issue: string;
  }>).map((r) => ({
    userId: r.user_id,
    email: r.email,
    nome: r.nome,
    tenantId: r.tenant_id,
    hasRole: r.has_role,
    hasTenant: r.has_tenant,
    issue: r.issue,
  }));
}
