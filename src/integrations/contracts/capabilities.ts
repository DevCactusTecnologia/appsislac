/**
 * Modelo CANÔNICO de capacidades de provider de integração laboratorial.
 *
 * FONTE ÚNICA OFICIAL — espelha o `ServerCapabilities`
 * declarado em `supabase/functions/_shared/drivers/types.ts`.
 *
 * Regras (IA-first governance):
 *  - Frontend NUNCA define capabilities — apenas consome/renderiza.
 *  - Adicionar nova chave aqui implica adicionar TAMBÉM em `ServerCapabilities`.
 *  - Chaves legadas (`pending_workflow`, `reprint_label`, `logistics_tracking`,
 *    `recollection`) são aliases retro-compatíveis: aceitos em
 *    `hasCapability(provider, "pending_workflow")` mas resolvidos para a
 *    chave canônica correspondente. Não criar novos aliases.
 */

import type { IntegrationProvider } from "./providers";

/** Chaves CANÔNICAS — devem coincidir com `ServerCapabilities` (Deno). */
export const CANONICAL_CAPABILITY_KEYS = [
  "send_order",
  "polling",
  "fetch_pdf",
  "fetch_pending",
  "fetch_trace",
  "fetch_label",
  "cancel_exam",
  "cancel_sample",
  "webhook",
] as const;

export type CanonicalCapabilityKey = typeof CANONICAL_CAPABILITY_KEYS[number];

export type ProviderCapabilities = Record<CanonicalCapabilityKey, boolean>;

/** Aliases legados aceitos apenas em leitura (compat). NÃO criar novos. */
export const LEGACY_CAPABILITY_ALIASES = {
  pending_workflow: "fetch_pending",
  reprint_label: "fetch_label",
  logistics_tracking: "fetch_trace",
  // recollection nunca teve mapeamento server-side — colapsa em fetch_pending
  recollection: "fetch_pending",
} as const satisfies Record<string, CanonicalCapabilityKey>;

export type LegacyCapabilityKey = keyof typeof LEGACY_CAPABILITY_ALIASES;
export type CapabilityKey = CanonicalCapabilityKey | LegacyCapabilityKey;

export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  send_order: false,
  polling: false,
  fetch_pdf: false,
  fetch_pending: false,
  fetch_trace: false,
  fetch_label: false,
  cancel_exam: false,
  cancel_sample: false,
  webhook: false,
};

/**
 * Normaliza uma declaração de capabilities — aceita chaves canônicas
 * e/ou legadas e devolve o objeto canônico completo.
 */
export function normalizeCapabilities(
  raw: Partial<Record<CapabilityKey, boolean>>,
): ProviderCapabilities {
  const out: ProviderCapabilities = { ...DEFAULT_CAPABILITIES };
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v !== "boolean") continue;
    const aliasMap = LEGACY_CAPABILITY_ALIASES as Record<string, CanonicalCapabilityKey>;
    const canonical: CanonicalCapabilityKey | null =
      aliasMap[k]
      ?? ((CANONICAL_CAPABILITY_KEYS as readonly string[]).includes(k)
        ? (k as CanonicalCapabilityKey)
        : null);
    if (!canonical) continue;
    // Mantém o valor mais "permissivo" caso canonical e legado coexistam.
    out[canonical] = out[canonical] || v;
  }
  return out;
}

const _registry = new Map<IntegrationProvider, ProviderCapabilities>();

export function registerCapabilities(
  provider: IntegrationProvider,
  caps: Partial<Record<CapabilityKey, boolean>>,
): void {
  _registry.set(provider, normalizeCapabilities(caps));
}

export function getCapabilities(provider: IntegrationProvider): ProviderCapabilities {
  return _registry.get(provider) ?? DEFAULT_CAPABILITIES;
}

export function hasCapability(
  provider: IntegrationProvider,
  cap: CapabilityKey,
): boolean {
  const canonical =
    (LEGACY_CAPABILITY_ALIASES as Record<string, CanonicalCapabilityKey>)[cap]
    ?? (cap as CanonicalCapabilityKey);
  return getCapabilities(provider)[canonical] === true;
}
