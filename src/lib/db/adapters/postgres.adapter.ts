/**
 * Adapter Postgres (database-per-tenant) — STUB.
 *
 * Placeholder para o futuro cenário multi-database. NUNCA é
 * instanciado em runtime hoje: o `clientFactory` só roteia para
 * cá quando `database_strategy === "dedicated"`, e nenhum tenant
 * está configurado assim.
 *
 * Quando chegar a hora, esta classe poderá usar `pg` ou um pool
 * dedicado, mantendo a mesma interface `DBAdapter` para que
 * nenhum chamador precise mudar.
 */

import type {
  DBAdapter,
  InsertRow,
  Row,
  SelectQuery,
  TableName,
  UpdateRow,
} from "../types";
import { DBAdapterError } from "../types";

export class PostgresAdapter implements DBAdapter {
  constructor(_databaseUrl: string) {
    // Conexão real será estabelecida na fase 2.
  }

  raw(_table: TableName): never {
    throw new DBAdapterError("PostgresAdapter.raw: not implemented yet (multi-db fase 2)");
  }
  async insert<T extends TableName>(
    _table: T,
    _payload: InsertRow<T> | InsertRow<T>[],
  ): Promise<Row<T>[]> {
    throw new DBAdapterError("PostgresAdapter.insert: not implemented yet (multi-db fase 2)");
  }
  async update<T extends TableName>(
    _table: T,
    _payload: UpdateRow<T>,
    _where: Partial<Row<T>>,
  ): Promise<Row<T>[]> {
    throw new DBAdapterError("PostgresAdapter.update: not implemented yet (multi-db fase 2)");
  }
  async delete<T extends TableName>(_table: T, _where: Partial<Row<T>>): Promise<void> {
    throw new DBAdapterError("PostgresAdapter.delete: not implemented yet (multi-db fase 2)");
  }
  async select<T extends TableName>(
    _table: T,
    _query?: SelectQuery<Row<T>>,
  ): Promise<Row<T> | Row<T>[] | null> {
    throw new DBAdapterError("PostgresAdapter.select: not implemented yet (multi-db fase 2)");
  }
}