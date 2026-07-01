/**
 * Runtime 2.0 — Identity Layer.
 *
 * Camada de identidade desacoplada do provedor. O domínio, o Runtime de
 * Database, as Edge Functions e as políticas RLS só conhecem esta interface.
 *
 * Implementação default: `SupabaseSharedIssuer` — usa o projeto Shared como
 * emissor JWT (RS256/ES256). Projetos Dedicated apenas VALIDAM o token via
 * chave pública (configurada no dashboard do projeto no provisionamento),
 * preservando `auth.uid()`, RLS e todo o domínio.
 *
 * Substituição futura (Keycloak, Auth0, Auth.js): trocar apenas a
 * implementação registrada aqui — nenhuma outra camada muda.
 *
 * Rejeitado explicitamente pelo usuário (D1):
 *   - Auth-per-tenant (duplicação operacional).
 *   - Signed context header via current_setting() (reescreveria ~200 policies).
 */

export interface IdentityClaims {
  sub: string;
  email?: string | null;
  role?: string | null;
  exp?: number;
  [k: string]: unknown;
}

export interface IdentitySession {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: number | null;
  user: { id: string; email?: string | null };
}

export interface IdentityIssuer {
  readonly name: string;
  /** Login por email/senha — retorna sessão canônica. */
  signInWithPassword(input: { email: string; password: string }): Promise<IdentitySession>;
  /** Sessão atual (ou null). */
  getSession(): Promise<IdentitySession | null>;
  /** Sign-out (invalida sessão local + revoga refresh se suportado). */
  signOut(): Promise<void>;
  /** Decodifica claims sem validar assinatura (validação real é no Postgres via JWKS). */
  parseClaims(token: string): IdentityClaims | null;
}

let _issuer: IdentityIssuer | null = null;

export function registerIdentityIssuer(issuer: IdentityIssuer): void {
  _issuer = issuer;
}

export function getIdentityIssuer(): IdentityIssuer {
  if (!_issuer) {
    throw new Error(
      "Identity Layer: nenhum issuer registrado. " +
      "Chame registerIdentityIssuer() durante o bootstrap.",
    );
  }
  return _issuer;
}
