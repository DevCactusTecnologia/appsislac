/**
 * persistOrThrow — helper global que GARANTE persistência real no Supabase.
 *
 * Regra de ouro do SISLAC: NENHUMA operação pode retornar sucesso sem que o
 * banco confirme as linhas afetadas. Isto evita falhas silenciosas onde o
 * frontend continua o fluxo achando que salvou algo que nunca foi gravado
 * (ex.: erro de RLS, conexão caída entre o request e o response, conflito
 * de constraint que o cliente ignorou).
 *
 * Uso:
 *   const [row] = await persistOrThrow(
 *     supabase.from("amostras").insert(payload),
 *     "soroteca.criarAmostra",
 *   );
 *
 * Para update múltiplo (zero linhas pode ser legítimo: filtro não casou),
 * use `expectAtLeast: 0`. Para confirmar que ao menos 1 linha mudou,
 * deixe o default (1).
 *
 * Para upsert, sempre encadeie `.select()` automaticamente — o helper força
 * isso via `.select()` no builder recebido.
 */

// Tipo intencionalmente largo: aceita qualquer query builder do supabase-js
// que termine em insert/update/upsert, antes ou depois do .select().
// Tipar de forma estrita exigiria importar PostgrestFilterBuilder genérico
// e os tipos da Database — preferimos a flexibilidade do helper global.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyQueryBuilder = {
  select: (cols?: string) => any;
  then: any;
};

export interface PersistOptions {
  /**
   * Mínimo de linhas que devem retornar do banco. Default = 1.
   * Use 0 quando "nenhuma linha afetada" é resultado válido (ex.: update
   * com filtro que pode não bater). NUNCA use 0 para insert.
   */
  expectAtLeast?: number;
  /** Garante .select() — default true. Desligue só se o builder já trouxe. */
  forceSelect?: boolean;
  /** Colunas retornadas pelo select forçado (default "*"). */
  selectCols?: string;
}

export class PersistError extends Error {
  readonly context: string;
  readonly cause?: unknown;
  readonly kind: "rls" | "constraint" | "empty" | "network" | "unknown";

  constructor(
    context: string,
    kind: PersistError["kind"],
    message: string,
    cause?: unknown,
  ) {
    super(`[persist:${context}] ${message}`);
    this.name = "PersistError";
    this.context = context;
    this.kind = kind;
    this.cause = cause;
  }
}

function classifyError(error: { code?: string; message?: string } | null): PersistError["kind"] {
  if (!error) return "unknown";
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("row-level security") || msg.includes("rls")) return "rls";
  if (error.code === "23505" || msg.includes("duplicate")) return "constraint";
  if (error.code === "23503" || msg.includes("foreign key")) return "constraint";
  if (msg.includes("network") || msg.includes("fetch")) return "network";
  return "unknown";
}

/**
 * Executa uma operação de escrita e VALIDA que o banco persistiu de fato.
 * Lança `PersistError` se houver erro ou retorno vazio.
 */
export async function persistOrThrow<T = any>(
  builder: AnyQueryBuilder,
  context: string,
  options: PersistOptions = {},
): Promise<T[]> {
  const { expectAtLeast = 1, forceSelect = true, selectCols = "*" } = options;

  const q = forceSelect ? builder.select(selectCols) : builder;

  let result: { data: any; error: any };
  try {
    result = await q;
  } catch (e) {
    throw new PersistError(context, "network", (e as Error).message, e);
  }

  const { data, error } = result;

  if (error) {
    throw new PersistError(context, classifyError(error), error.message ?? "erro desconhecido", error);
  }

  const rows: T[] = Array.isArray(data) ? data : data ? [data] : [];

  if (rows.length < expectAtLeast) {
    throw new PersistError(
      context,
      "empty",
      `esperado ao menos ${expectAtLeast} linha(s), retornou ${rows.length}. ` +
        `Possível RLS bloqueando, filtro sem match ou trigger AFTER que falhou.`,
    );
  }

  return rows;
}

/** Variante para quando se espera EXATAMENTE 1 linha (insert único, upsert único). */
export async function persistOneOrThrow<T = any>(
  builder: AnyQueryBuilder,
  context: string,
  options: Omit<PersistOptions, "expectAtLeast"> = {},
): Promise<T> {
  const rows = await persistOrThrow<T>(builder, context, { ...options, expectAtLeast: 1 });
  if (rows.length > 1) {
    throw new PersistError(
      context,
      "unknown",
      `esperado exatamente 1 linha, retornou ${rows.length}.`,
    );
  }
  return rows[0];
}
