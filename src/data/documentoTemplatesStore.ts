// Store de Templates de Documentos (comprovantes, declarações, cabeçalho, rodapé)
// armazenados na tabela `documento_templates` no Supabase.
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { extractPlaceholders } from "@/lib/mapaPlaceholders";
import { removerLinhasHorizontaisDocumento } from "@/lib/documentoTemplatesPadrao";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { DocumentoConfig, JsonObject, JsonValue } from "@/types/domain";

export type DocumentoTipo =
  | "comprovante_pagamento"
  | "comprovante_atendimento"
  | "declaracao_comparecimento"
  | "cabecalho"
  | "rodape"
  | "documento"
  | "orcamento";

export const DOCUMENTO_TIPO_LABELS: Record<DocumentoTipo, string> = {
  comprovante_pagamento: "Comprovante de Pagamento",
  comprovante_atendimento: "Comprovante de Atendimento",
  declaracao_comparecimento: "Declaração de Comparecimento",
  cabecalho: "Cabeçalho",
  rodape: "Rodapé",
  documento: "Modelo de Documento",
  orcamento: "Orçamento",
};

export interface DocumentoTemplate {
  id: string;
  tipo: DocumentoTipo;
  nome: string;
  descricao: string;
  conteudo: string; // HTML do editor com {{placeholders}}
  placeholdersUsados: string[];
  config: DocumentoConfig;
  ativo: boolean;
  padrao: boolean;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

type DocumentoTemplateRow = Tables<"documento_templates">;
type DocumentoTemplateInsert = TablesInsert<"documento_templates">;
type DocumentoTemplateUpdate = TablesUpdate<"documento_templates">;

const asJsonObject = (v: unknown): JsonObject =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {};

let _templates: DocumentoTemplate[] = [];
let _listeners: Array<() => void> = [];
let _initStarted = false;
let _initPromise: Promise<void> | null = null;
const notify = () => _listeners.forEach((fn) => fn());

const fromRow = (r: DocumentoTemplateRow): DocumentoTemplate => ({
  id: r.id,
  tipo: r.tipo as DocumentoTipo,
  nome: r.nome ?? "",
  descricao: r.descricao ?? "",
  conteudo: removerLinhasHorizontaisDocumento(r.conteudo ?? ""),
  placeholdersUsados: Array.isArray(r.placeholders_usados)
    ? (r.placeholders_usados.filter((x): x is string => typeof x === "string"))
    : [],
  config: asJsonObject(r.config),
  ativo: !!r.ativo,
  padrao: !!r.padrao,
  criadoPor: r.criado_por ?? "",
  criadoEm: r.created_at ?? "",
  atualizadoEm: r.updated_at ?? "",
});

const toRow = (m: Partial<DocumentoTemplate>): DocumentoTemplateUpdate => {
  const row: DocumentoTemplateUpdate = {};
  if (m.tipo !== undefined) row.tipo = m.tipo;
  if (m.nome !== undefined) row.nome = m.nome;
  if (m.descricao !== undefined) row.descricao = m.descricao;
  if (m.conteudo !== undefined) {
    row.conteudo = removerLinhasHorizontaisDocumento(m.conteudo);
    row.placeholders_usados = extractPlaceholders(row.conteudo) as unknown as JsonValue;
  }
  if (m.config !== undefined) row.config = m.config as JsonObject;
  if (m.ativo !== undefined) row.ativo = m.ativo;
  if (m.padrao !== undefined) row.padrao = m.padrao;
  if (m.criadoPor !== undefined) row.criado_por = m.criadoPor;
  return row;
};

export async function _initDocumentoTemplatesStore(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initStarted = true;
  _initPromise = (async () => {
    // Retry com backoff: o conteudo dos templates (cabeçalho institucional)
    // pode passar de 150KB e ocasionalmente falha com "Failed to fetch"
    // em redes instáveis. Sem o cabeçalho carregado o laudo cai no
    // fallback "LAUDO DE EXAMES LABORATORIAIS" — comportamento que o
    // usuário interpreta (com razão) como cabeçalho destruído.
    const maxAttempts = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase
          .from("documento_templates")
          .select(
            "id, tipo, nome, descricao, conteudo, placeholders_usados, config, ativo, padrao, criado_por, created_at, updated_at, tenant_id"
          )
          .order("tipo")
          .order("nome");
        if (error) throw error;
        _templates = ((data ?? []) as DocumentoTemplateRow[]).map(fromRow);
        notify();
        return;
      } catch (e) {
        lastError = e;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }
    // Falha persistente: solta o lock para que próxima chamada possa
    // re-tentar (ex.: ao clicar em Imprimir o caller faz ensureLoaded).
    _initStarted = false;
    _initPromise = null;
    showError(lastError, { scope: "documentoTemplatesStore.init", silent: true });
  })();
  return _initPromise;
}

/**
 * Garante que o store foi inicializado pelo menos uma vez. Se ainda não foi,
 * dispara o init (assíncrono) — útil para casos em que algum consumidor lê
 * o store antes do boot principal terminar (ex.: reload rápido na tela de
 * atendimentos). O retorno é a lista atual (síncrona); chame `await`
 * apenas quando precisar dos dados imediatamente após o boot inicial.
 */
export function ensureDocumentoTemplatesLoaded(): Promise<void> {
  if (!_initStarted) {
    return _initDocumentoTemplatesStore();
  }
  return _initPromise ?? Promise.resolve();
}

export const getDocumentoTemplates = (): DocumentoTemplate[] => _templates;

export const getDocumentoTemplatesPorTipo = (tipo: DocumentoTipo): DocumentoTemplate[] =>
  _templates.filter((t) => t.tipo === tipo);

/**
 * Retorna o template a ser usado para um tipo:
 *  1) Primeiro o ATIVO + PADRÃO (escolha explícita do usuário).
 *  2) Caso ninguém esteja marcado como padrão, usa o ÚNICO template ativo
 *     daquele tipo (fallback amigável — evita que o usuário precise marcar
 *     "padrão" manualmente quando só existe um).
 */
export const getTemplatePadrao = (tipo: DocumentoTipo): DocumentoTemplate | null => {
  const padrao = _templates.find((t) => t.tipo === tipo && t.ativo && t.padrao);
  if (padrao) return padrao;
  const ativos = _templates.filter((t) => t.tipo === tipo && t.ativo);
  return ativos.length === 1 ? ativos[0] : null;
};

export async function addDocumentoTemplate(
  data: Omit<DocumentoTemplate, "id" | "criadoEm" | "atualizadoEm" | "placeholdersUsados">
): Promise<DocumentoTemplate | null> {
  try {
    const tenant_id = await getCurrentTenantId();
    // Se ainda não existe nenhum template do mesmo tipo, força padrão=true
    // para que o documento já seja usado automaticamente sem ação extra.
    const jaExisteDoTipo = _templates.some((t) => t.tipo === data.tipo);
    const dataFinal = jaExisteDoTipo ? data : { ...data, padrao: true, ativo: true };
    const insertPayload: DocumentoTemplateInsert = {
      ...toRow(dataFinal),
      nome: dataFinal.nome,
      tipo: dataFinal.tipo,
      tenant_id,
    };
    const row = await persistOneOrThrow<DocumentoTemplateRow>(
      supabase.from("documento_templates").insert(insertPayload),
      "documentoTemplates.add",
    );
    const novo = fromRow(row);
    _templates = [..._templates, novo].sort((a, b) =>
      a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo.localeCompare(b.tipo)
    );
    notify();
    return novo;
  } catch (e) {
    showError(e, { scope: "documentoTemplatesStore.add" });
    return null;
  }
}

export async function updateDocumentoTemplate(
  id: string,
  data: Partial<DocumentoTemplate>
): Promise<boolean> {
  const prev = _templates;
  _templates = _templates.map((t) => (t.id === id ? { ...t, ...data } : t));
  notify();
  try {
    await persistOrThrow(
      supabase.from("documento_templates").update(toRow(data)).eq("id", id),
      "documentoTemplates.update",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "documentoTemplatesStore.update" });
    _templates = prev;
    notify();
    return false;
  }
}

export async function removeDocumentoTemplate(id: string): Promise<boolean> {
  const target = _templates.find(t => t.id === id);
  // Bloqueia remoção se for template padrão ou criado pelo sistema (protegidos)
  if (target?.padrao || target?.criadoPor === "sistema") return false;
  const prev = _templates;
  _templates = _templates.filter((t) => t.id !== id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("documento_templates").delete().eq("id", id),
      "documentoTemplates.remove",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "documentoTemplatesStore.remove" });
    _templates = prev;
    notify();
    return false;
  }
}

export async function duplicarDocumentoTemplate(id: string): Promise<DocumentoTemplate | null> {
  const orig = _templates.find((t) => t.id === id);
  if (!orig) return null;
  return addDocumentoTemplate({
    tipo: orig.tipo,
    nome: `${orig.nome} (cópia)`,
    descricao: orig.descricao,
    conteudo: orig.conteudo,
    config: orig.config,
    ativo: orig.ativo,
    padrao: false, // cópia nunca nasce padrão
    criadoPor: orig.criadoPor,
  });
}

export function subscribeDocumentoTemplates(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
