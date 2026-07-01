# 01 — Auth (Identity Layer)

## Decisão arquitetural (D1)

Estratégia aprovada pelo usuário: **JWT compartilhado com Identity Layer abstraído**.

- Emissor atual: projeto Shared (Supabase GoTrue).
- Validação: cada projeto Dedicated é configurado no dashboard com a mesma chave pública (RS256/ES256) do Shared. `auth.uid()` funciona nativo.
- Rejeitado: Auth-per-tenant (D1.B), Signed context header (D1.C).
- Futuro: emissor pode ser trocado (Keycloak/Auth0/Auth.js) sem alterar Runtime, Edge Functions, RLS ou domínio.

## Implementação — Slice 1 (esta fase)

- Nova camada `src/runtime/identity/`:
  - `index.ts` — contrato `IdentityIssuer` (signIn/getSession/signOut/parseClaims).
  - `supabaseIssuer.ts` — implementação default usando o cliente Shared.
- Server: `supabase/functions/_shared/runtime/identity.ts` — `ServerIdentityValidator` extrai claims do Authorization header. Default = decodifica JWT emitido pelo Shared. Substituição via `setIdentityValidator`.

O `AuthContext.tsx` continua funcional sem alterações — o Identity Layer é aditivo. A migração de todos os call sites (`sharedClient.auth.*` → `getIdentityIssuer().*`) ocorre em Slice 2 (não bloqueia a arquitetura).

## Pré-requisito operacional para Dedicated real

No provisionamento de cada tenant dedicated:
1. Copiar `JWT Signing Keys (public)` do projeto Shared.
2. Configurar no dashboard do projeto Dedicated em `Auth → JWT Keys → Import public key`.
3. Validar via probe `select auth.uid()` autenticado.

Documentado em `docs/database-runtime/dedicated-runtime/07-migration-pipeline.md` como etapa `configure-jwt-federation`.

## Status

| Item | Estado |
|---|---|
| Identity Layer front | ✓ implementado |
| Identity Layer server | ✓ implementado |
| Fluxo único login | ✓ (Shared como issuer) |
| Duplicação de auth | ✗ eliminada por design |
| Dependência do projeto Shared | ✓ (intencional; só como emissor, trocável) |
| JWT federation ativo em algum tenant | ✗ pendente configuração manual + validação |

## Bloqueadores restantes

- Configuração manual da chave pública em cada projeto Dedicated (etapa do wizard).
- Migração dos call sites `sharedClient.auth.*` → `getIdentityIssuer()` (Slice 2).
- Remoção do workaround `tenant-dedicated-login-gate` após validação real do JWT no Dedicated.
