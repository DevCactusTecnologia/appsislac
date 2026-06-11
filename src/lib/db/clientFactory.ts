/**
 * Connection factory — devolve o `DBAdapter` correto para o contexto.
 *
 * Hoje sempre retorna `SupabaseAdapter` (estratégia "shared").
 * Quando habilitarmos "dedicated" no futuro, este é o ÚNICO ponto
 * que muda — todos os chamadores de `db.*` continuam idênticos.
 */

import type { DBAdapter, TenantContext } from "./types";
import { supabaseAdapter } from "./adapters/supabase.adapter";
import { PostgresAdapter } from "./adapters/postgres.adapter";
import { DBAdapterError } from "./types";

const _dedicatedAdapters = new Map<string, DBAdapter>();

export function getDBClient(ctx: TenantContext): DBAdapter {
  if (ctx.database_strategy === "shared") {
    return supabaseAdapter;
  }

  // Estratégia "dedicated" — não suportada em runtime ainda.
  if (!ctx.database_url) {
    throw new DBAdapterError(
      `Tenant ${ctx.tenant_id} marcado como "dedicated" mas sem database_url configurada.`,
    );
  }
  let adapter = _dedicatedAdapters.get(ctx.tenant_id);
  if (!adapter) {
    adapter = new PostgresAdapter(ctx.database_url);
    _dedicatedAdapters.set(ctx.tenant_id, adapter);
  }
  return adapter;
}