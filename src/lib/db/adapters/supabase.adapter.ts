/**
 * Adapter Supabase — implementação atual da camada `db.*`.
 *
 * Encapsula `supabase.from(...)` mantendo a invariante do SISLAC:
 * toda escrita passa por `persistOrThrow` para garantir que o
 * banco confirmou as linhas afetadas.
 *
 * Este adapter é o único usado em runtime hoje (estratégia "shared").
 */

import { supabase } from "@/integrations/supabase/client";
import { persistOrThrow } from "@/lib/persist";
import type {
  DBAdapter,
  InsertRow,
  Row,
  SelectQuery,
  TableName,
  UpdateRow,
} from "../types";

/**
 * Builder do supabase-js exposto como `unknown` para o consumidor —
 * ele faz cast explícito quando precisa encadear `.or`, `.ilike`, joins, etc.
 * Internamente usamos um shape mínimo para encadear filtros.
 */
type FilterableBuilder = {
  eq: (column: string, value: unknown) => FilterableBuilder;
  order: (column: string, opts?: { ascending?: boolean }) => FilterableBuilder;
  limit: (n: number) => FilterableBuilder;
  range: (from: number, to: number) => FilterableBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: Promise<{ data: unknown; error: unknown }>["then"];
};

export class SupabaseAdapter implements DBAdapter {
  raw(table: TableName) {
    return supabase.from(table);
  }

  async insert<T extends TableName>(
    table: T,
    payload: InsertRow<T> | InsertRow<T>[],
  ): Promise<Row<T>[]> {
    // O cast `as never` no payload é o pattern oficial para repassar um
    // payload genérico ao supabase-js: o overload exige a variante exata
    // da tabela e só consegue resolvê-la quando `T` é literal.
    const builder = supabase.from(table).insert(payload as never);
    return await persistOrThrow<Row<T>>(
      builder as unknown as Parameters<typeof persistOrThrow>[0],
      `db.insert(${table})`,
      { expectAtLeast: 1 },
    );
  }

  async update<T extends TableName>(
    table: T,
    payload: UpdateRow<T>,
    where: Partial<Row<T>>,
  ): Promise<Row<T>[]> {
    let q = supabase
      .from(table)
      .update(payload as never) as unknown as FilterableBuilder;
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    // Update pode legitimamente afetar 0 linhas (filtro sem match).
    return await persistOrThrow<Row<T>>(
      q as unknown as Parameters<typeof persistOrThrow>[0],
      `db.update(${table})`,
      { expectAtLeast: 0 },
    );
  }

  async delete<T extends TableName>(table: T, where: Partial<Row<T>>): Promise<void> {
    let q = supabase.from(table).delete() as unknown as FilterableBuilder;
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const { error } = (await (q as unknown as Promise<{ error: unknown }>)) as {
      error: unknown;
    };
    if (error) throw error;
  }

  async select<T extends TableName>(
    table: T,
    query: SelectQuery<Row<T>> = {},
  ): Promise<Row<T> | Row<T>[] | null> {
    const cols = query.columns ?? "*";
    let q = supabase.from(table).select(cols) as unknown as FilterableBuilder;
    if (query.eq) {
      for (const [k, v] of Object.entries(query.eq)) q = q.eq(k, v);
    }
    if (query.order) {
      for (const o of query.order) {
        q = q.order(o.column, { ascending: o.ascending ?? true });
      }
    }
    if (typeof query.limit === "number") q = q.limit(query.limit);
    if (typeof query.offset === "number" && typeof query.limit === "number") {
      q = q.range(query.offset, query.offset + query.limit - 1);
    }
    if (query.single) {
      const { data, error } = await q.single();
      if (error) throw error;
      return data as Row<T>;
    }
    if (query.maybeSingle) {
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row<T> | null;
    }
    const { data, error } = (await (q as unknown as Promise<{
      data: unknown;
      error: unknown;
    }>)) as { data: unknown; error: unknown };
    if (error) throw error;
    return (data ?? []) as Row<T>[];
  }
}

/** Singleton — todos os tenants "shared" compartilham a mesma instância. */
export const supabaseAdapter = new SupabaseAdapter();