/**
 * Camada `db.*` — entrypoint público.
 *
 * USO (opcional, em código novo):
 *
 *   import { db } from "@/lib/db";
 *   const pacientes = await db.select("pacientes", { eq: { ativo: true } });
 *   const [novo]   = await db.insert("pacientes", { nome: "Ana", tenant_id });
 *
 * Para casos que precisam do builder completo do supabase-js
 * (joins, .or, .ilike, etc.), use o escape hatch:
 *
 *   const q = db.raw("atendimentos").select("*, atendimento_exames(*)");
 *
 * IMPORTANTE: o código atual NÃO foi alterado. Continua usando
 * `supabase.from(...)` direto. Esta camada é aditiva e opcional —
 * adoção será gradual nos módulos críticos quando o time decidir.
 */

import type {
  DBAdapter,
  InsertRow,
  Row,
  SelectQuery,
  TableName,
  UpdateRow,
} from "./types";
import { getTenantContext } from "./tenantResolver";
import { getDBClient } from "./clientFactory";

async function adapter(): Promise<DBAdapter> {
  const ctx = await getTenantContext();
  return getDBClient(ctx);
}

export const db = {
  async insert<T extends TableName>(
    table: T,
    payload: InsertRow<T> | InsertRow<T>[],
  ): Promise<Row<T>[]> {
    return (await adapter()).insert<T>(table, payload);
  },
  async update<T extends TableName>(
    table: T,
    payload: UpdateRow<T>,
    where: Partial<Row<T>>,
  ): Promise<Row<T>[]> {
    return (await adapter()).update<T>(table, payload, where);
  },
  async delete<T extends TableName>(table: T, where: Partial<Row<T>>): Promise<void> {
    return (await adapter()).delete<T>(table, where);
  },
  async select<T extends TableName>(
    table: T,
    query?: SelectQuery<Row<T>>,
  ): Promise<Row<T> | Row<T>[] | null> {
    return (await adapter()).select<T>(table, query);
  },
  /**
   * Escape hatch — devolve o builder nativo do adapter atual.
   * Hoje retorna o builder do supabase-js. Quando um tenant for
   * "dedicated", lançará erro até que o PostgresAdapter implemente.
   */
  raw(table: TableName) {
    // Sincronamente é impossível resolver o tenant; expomos como Promise.
    return adapter().then((a) => a.raw(table));
  },
};

export type {
  DBAdapter,
  TenantContext,
  SelectQuery,
  DBStrategy,
  TableName,
  Row,
  InsertRow,
  UpdateRow,
} from "./types";
export { getTenantContext, clearTenantContextCache } from "./tenantResolver";
export { getDBClient } from "./clientFactory";