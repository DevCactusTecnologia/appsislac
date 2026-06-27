/**
 * SSOT — Contexto temporário de impressão de laudo.
 *
 * Único contrato e única chave de sessionStorage usados pelo fluxo
 *
 *   ResultadoDetalhe → window.open → /resultado/:id/print → window.print()
 *
 * Regras (constraint travada por @worklab-style-print):
 *   • Não usar query string, localStorage, store global, contexto React
 *     ou eventos customizados para transmitir dados entre as duas páginas.
 *   • Todo acesso ao sessionStorage relacionado à impressão DEVE passar
 *     por estes helpers — nada de `sessionStorage.setItem(...)` espalhado.
 *   • O contexto expira em 15 minutos (TTL) e é destruído após o print.
 *   • Apenas o contexto é gravado: nenhuma informação aparece na URL.
 *
 * O campo `html` carrega o laudo já renderizado (mesmo HTML que o iframe
 * oculto consumia até esta refatoração) — mantém a impressão vetorial
 * instantânea sem refazer queries/CKEditor/layouts na página de impressão.
 */

export const PRINT_CONTEXT_KEY = "sislac:print-context";

/** TTL do contexto (15 min). Após isso é descartado mesmo que ainda exista. */
export const PRINT_CONTEXT_TTL_MS = 15 * 60 * 1000;

export interface PrintContextWatermark {
  enabled: boolean;
  url: string | null;
  opacity: number;
  sizePct: number;
  rotation: number;
}

export interface PrintContext {
  /** Id do atendimento (mesmo `:id` da rota /resultado/:id). */
  atendimentoId: string;
  /** Ids dos exames a imprimir, em string para serializar com segurança. */
  exameIds: string[];
  /** Solicitante associado (label legível) quando aplicável. */
  solicitanteId?: string;
  /** Modo da impressão. */
  modo: "todos" | "selecionados";
  /** HTML do laudo já renderizado, pronto para o Document Engine. */
  html: string;
  /** Título do documento (usado pelo Chrome ao "Salvar como PDF"). */
  title: string;
  /** Marca d'água (snapshot do `tenant_lab_config.watermark` no momento da impressão). */
  watermark?: PrintContextWatermark;
  /** Timestamp (ms) de criação — base do TTL. */
  createdAt: number;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function savePrintContext(ctx: PrintContext): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(PRINT_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* quota / privacy mode — ignora silenciosamente */
  }
}

/**
 * Retorna o contexto vigente ou `null` se não houver, estiver corrompido
 * ou tiver expirado. Em caso de expiração/corrupção a chave é removida.
 */
export function loadPrintContext(): PrintContext | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(PRINT_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PrintContext;
    if (
      !parsed ||
      typeof parsed.atendimentoId !== "string" ||
      typeof parsed.html !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      storage.removeItem(PRINT_CONTEXT_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > PRINT_CONTEXT_TTL_MS) {
      storage.removeItem(PRINT_CONTEXT_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(PRINT_CONTEXT_KEY);
    return null;
  }
}

export function clearPrintContext(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(PRINT_CONTEXT_KEY);
  } catch {
    /* noop */
  }
}
