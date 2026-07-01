/**
 * Runtime 2.0 — Tipos canônicos do Database Runtime.
 *
 * Princípio Zero: o restante do SISLAC não conhece o provedor.
 * Apenas consome `db()`/`auth()`/`storage()`/`functions()`/`realtime()`
 * exportados de `@/runtime/db`. Estes tipos descrevem a fronteira.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Estratégias suportadas pelo Runtime. */
export type RuntimeStrategy = "shared" | "dedicated";

/** Contexto resolvido para um tenant — fonte de verdade da Factory. */
export interface TenantRuntimeContext {
  tenant_id: string;
  strategy: RuntimeStrategy;
  /** Identificador estável do projeto/banco (ex.: project ref ou host). */
  project_ref: string;
  /** URL bruta opcional (apenas para `dedicated`). */
  database_url: string | null;
  /** Anon key do projeto dedicado (publishable). Só definido em `dedicated`. */
  anon_key?: string | null;
  /**
   * Fase 2 — allowlist de tabelas que devem ir para o dedicado.
   * Tabelas fora desta lista continuam roteando para o shared, mesmo
   * quando `strategy === "dedicated"`.
   */
  allowed_tables?: string[];
}

/** Cliente runtime — hoje 1:1 com SupabaseClient, mas tipado pela fronteira. */
export type RuntimeClient = SupabaseClient<Database>;

/** Contrato de uma estratégia (Shared/Dedicated). */
export interface RuntimeStrategyAdapter {
  readonly kind: RuntimeStrategy;
  /** Cria (ou retorna do cache interno da strategy) um cliente para o contexto. */
  createClient(ctx: TenantRuntimeContext): RuntimeClient;
  /** Libera recursos (canais realtime, listeners) — usado em logout/troca. */
  dispose(ctx: TenantRuntimeContext): Promise<void> | void;
}

/** Erro tipado para falhas de Runtime — facilita observabilidade. */
export class RuntimeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RuntimeError";
  }
}
