# 08 — Segurança Server

## Chaves
| Chave | Uso | Escopo |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `getPlatformClient`, admin plane | Apenas Edge Functions |
| `SUPABASE_ANON_KEY` | `getUserClient` + `getUserTenantClient` | JWT do usuário |
| `SB_SERVICE_ROLE_<ref>` | Dedicated tenants (service-role remoto) | 1 por tenant migrado |
| `<db_anon_key_ref>` | Dedicated user-scoped | 1 por tenant migrado |

## JWT
- Todas as edges que exigem usuário → `edgeBoot({require_auth: true})` chama `admin.auth.getUser(token)` (verificação server-side).
- `require_tenant: true` adiciona resolve `profiles.tenant_id` e retorna 403 `tenant_unresolved` se ausente.
- Frontend nunca envia `tenant_id`; sempre resolvido server-side.

## Super Admin
- Todas as `super-admin-*` revalidam `is_super_admin()` via RPC antes de qualquer ação (defesa em profundidade — não confia apenas em JWT claim).
- Impersonação: `super-admin-impersonate-tenant` emite tokens temporários; ação auditada em `integration_logs`.

## RLS
- 373 policies (audit fase 05) cobrindo 119 tabelas.
- Convenção obrigatória: `current_tenant_id()` + `is_super_admin()` + `has_permission()`.
- `SET search_path = public` em todas as RPCs SECURITY DEFINER (mitiga hijack).

## Validação
- `edgeBoot` valida `Authorization: Bearer`, correlation-id regex, JSON parse defensivo.
- Handlers específicos validam body (ex.: `tenant-resolve` limita `identifier` a 200 chars, regex por tipo).
- Erros públicos são genéricos (`safeError`); erros internos ficam no log com `correlation_id`.

## Secrets governance
- `_shared/drivers/credentials.ts` — cifra/decifra credenciais por tenant (key versionada).
- `_shared/crypto.ts` — helpers de hash/HMAC (`_get_protocolo_hmac_key`).
- `_shared/hardening.ts` — headers, rate-limit, canonicalização.

## Rate-limit
`_shared/rateLimit.ts` — bucket em memória por (tenant, ip, action). Aplicado em endpoints públicos (`leads-manager`, `tenant-resolve`).
