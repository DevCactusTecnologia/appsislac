/**
 * Runtime 2.0 — DedicatedStrategy (Fase 2, ativo).
 *
 * Cria um `SupabaseClient` apontando para o projeto Supabase dedicado
 * do tenant. É um transport de DADOS puro — auth continua no shared
 * (a sessão é gerenciada pelo cliente shared). Por isso as opções de
 * auth são desligadas aqui.
 *
 * Se o contexto não trouxer `database_url` + `anon_key`, lança
 * `RuntimeError` — a Factory tem responsabilidade de garantir que só
 * chamamos esta strategy quando os dois estão presentes.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RuntimeError, type RuntimeClient, type RuntimeStrategyAdapter, type TenantRuntimeContext } from "../types";

// Cache local por (url::anon_key) — evita recriar client no mesmo tenant.
const clientCache = new Map<string, RuntimeClient>();

export const dedicatedStrategy: RuntimeStrategyAdapter = {
  kind: "dedicated",
  createClient(ctx: TenantRuntimeContext): RuntimeClient {
    const url = ctx.database_url;
    const anon = ctx.anon_key;
    if (!url || !anon) {
      throw new RuntimeError(
        `Dedicated runtime requer database_url + anon_key (tenant=${ctx.tenant_id}).`,
        "RUNTIME_DEDICATED_MISSING_CREDENTIALS",
      );
    }
    const key = `${url}::${anon.slice(-12)}`;
    const hit = clientCache.get(key);
    if (hit) return hit;

    const client = createClient<Database>(url, anon, {
      auth: {
        // Sessão vive no cliente shared — este transport é só dados.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    clientCache.set(key, client);
    return client;
  },
  dispose(ctx: TenantRuntimeContext) {
    const url = ctx.database_url;
    const anon = ctx.anon_key;
    if (!url || !anon) return;
    clientCache.delete(`${url}::${anon.slice(-12)}`);
  },
};
