/**
 * Camada de abstração de dados — TIPOS (Fase 1).
 *
 * Esta camada existe para preparar o SISLAC para um futuro
 * cenário multi-database (database-per-tenant) sem alterar o
 * comportamento atual. Todos os módulos seguem usando
 * `supabase.from(...)` diretamente; a camada `db.*` é opcional
 * e adicionada lado a lado.
 *
 * Regras invioláveis:
 *  - Backward-compatible 100%.
 *  - Internamente usa `persistOrThrow` para garantir persistência.
 *  - Nenhum adapter "dedicated" é executado nesta fase.
 */

import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export type DBStrategy = "shared" | "dedicated";

export interface TenantContext {
  tenant_id: string;
  database_strategy: DBStrategy;
  /** Apenas relevante quando strategy === "dedicated" (futuro). */
  database_url?: string | null;
}

/** Nomes de tabelas públicas conhecidos pelo schema gerado. */
export type TableName = keyof Database["public"]["Tables"];

/** Atalhos para a Row/Insert/Update de uma tabela específica. */
export type Row<T extends TableName> = Tables<T>;
export type InsertRow<T extends TableName> = TablesInsert<T>;
export type UpdateRow<T extends TableName> = TablesUpdate<T>;

export interface SelectQuery<T = Record<string, unknown>> {
  /** Lista de colunas (ex.: "id,nome") ou "*" (default). */
  columns?: string;
  /** Filtros simples no formato { coluna: valor }. Use `filters` para operadores avançados. */
  eq?: Partial<T>;
  /** Ordenação opcional. */
  order?: { column: keyof T & string; ascending?: boolean }[];
  /** Limite e offset opcionais. */
  limit?: number;
  offset?: number;
  /** Retorna single() em vez de array. */
  single?: boolean;
  /** Retorna maybeSingle() em vez de array. */
  maybeSingle?: boolean;
}

/**
 * Builder "raw" devolvido pelo escape hatch `raw()` — preservamos a forma
 * livre porque diferentes adapters (Supabase hoje, Postgres no futuro)
 * expõem APIs distintas. Os call sites que usam `raw()` aceitam esta
 * incerteza explicitamente.
 */
export type RawBuilder = unknown;

export interface DBAdapter {
  /** Insere uma linha (ou várias) e devolve as linhas persistidas. */
  insert<T extends TableName>(
    table: T,
    payload: InsertRow<T> | InsertRow<T>[],
  ): Promise<Row<T>[]>;

  /** Atualiza linhas que casarem com `where`. Usa persistOrThrow com expectAtLeast=0. */
  update<T extends TableName>(
    table: T,
    payload: UpdateRow<T>,
    where: Partial<Row<T>>,
  ): Promise<Row<T>[]>;

  /** Remove linhas que casarem com `where`. */
  delete<T extends TableName>(table: T, where: Partial<Row<T>>): Promise<void>;

  /** Seleciona linhas. Retorna array (ou objeto único quando single/maybeSingle). */
  select<T extends TableName>(
    table: T,
    query?: SelectQuery<Row<T>>,
  ): Promise<Row<T> | Row<T>[] | null>;

  /** Acesso "raw" ao builder do adapter — escape hatch para casos avançados. */
  raw(table: TableName): RawBuilder;
}

export class DBAdapterError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DBAdapterError";
  }
}