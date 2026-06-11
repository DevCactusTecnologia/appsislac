// Helper único de credenciais por integração.
// - Cache em memória por `integration_id` (TTL 60s) para reduzir round-trips.
// - Suporta key_version: tenta decifrar com a chave atual e, se falhar,
//   cai para a chave anterior (rotação backward-compatible).
// - Nunca loga password em claro; consumidores recebem apenas o objeto.

import { decryptSecret } from "../crypto.ts";
import type { AdminClient } from "../integrationLog.ts";

export interface IntegrationCredentials {
  username: string;
  password: string;
  keyVersion: number;
}

interface CacheEntry { value: IntegrationCredentials; expiresAt: number }
const _cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export function invalidateCredentialsCache(integrationId?: string): void {
  if (integrationId) _cache.delete(integrationId);
  else _cache.clear();
}

export async function loadIntegrationCredentials(
  admin: AdminClient,
  integrationId: string,
): Promise<IntegrationCredentials> {
  const now = Date.now();
  const hit = _cache.get(integrationId);
  if (hit && hit.expiresAt > now) return hit.value;

  const { data: cred } = await admin
    .from("integration_credentials")
    .select("username, password_encrypted, key_version")
    .eq("integration_id", integrationId)
    .maybeSingle();

  const username = (cred?.username as string | null) ?? "";
  const keyVersion = (cred?.key_version as number | null) ?? 1;
  let password = "";
  const encrypted = (cred?.password_encrypted as string | null) ?? "";
  if (encrypted) {
    try {
      password = await decryptSecret(encrypted);
    } catch (errPrimary) {
      // Fallback: chave anterior (rotação)
      const prev = Deno.env.get("INTEGRATION_CRYPTO_KEY_PREVIOUS");
      if (prev) {
        const main = Deno.env.get("INTEGRATION_CRYPTO_KEY");
        try {
          // Troca temporária da env var
          Deno.env.set("INTEGRATION_CRYPTO_KEY", prev);
          password = await decryptSecret(encrypted);
        } catch (errPrev) {
          if (main) Deno.env.set("INTEGRATION_CRYPTO_KEY", main);
          throw errPrev;
        } finally {
          if (main) Deno.env.set("INTEGRATION_CRYPTO_KEY", main);
        }
      } else {
        throw errPrimary;
      }
    }
  }

  const value: IntegrationCredentials = { username, password, keyVersion };
  _cache.set(integrationId, { value, expiresAt: now + TTL_MS });
  return value;
}
