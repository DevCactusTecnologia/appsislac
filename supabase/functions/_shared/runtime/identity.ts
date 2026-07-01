// Runtime 2.0 — Identity Layer (server).
//
// Contrato de identidade server-side. A validação real do JWT ocorre no
// Postgres (via JWKS configurado no projeto — Shared assina, Dedicated
// valida com a mesma chave pública). Esta camada só EXTRAI e VERIFICA
// claims mínimas antes de decidir tenant/permissões.
//
// Reescrever para outro provedor (Keycloak, Auth0) = trocar a
// implementação registrada; nenhuma edge function muda.

export interface IdentityClaims {
  sub: string;
  email?: string | null;
  role?: string | null;
  exp?: number;
  [k: string]: unknown;
}

export interface ServerIdentityValidator {
  readonly name: string;
  /** Extrai claims do Authorization header. Retorna null se inválido/ausente. */
  extractClaims(authHeader: string | null): IdentityClaims | null;
}

function decodeJwt(token: string): IdentityClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    const claims = JSON.parse(json) as IdentityClaims;
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

class SupabaseSharedValidator implements ServerIdentityValidator {
  readonly name = "supabase-shared";
  extractClaims(authHeader: string | null): IdentityClaims | null {
    if (!authHeader?.startsWith("Bearer ")) return null;
    return decodeJwt(authHeader.slice(7));
  }
}

let _validator: ServerIdentityValidator = new SupabaseSharedValidator();

export function getIdentityValidator(): ServerIdentityValidator {
  return _validator;
}

export function setIdentityValidator(v: ServerIdentityValidator): void {
  _validator = v;
}
