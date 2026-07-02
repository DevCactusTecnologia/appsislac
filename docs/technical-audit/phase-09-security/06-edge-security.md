# 06 — Edge Functions Security

## Total: 74 edges

## Padrão de autenticação
- **`edgeBoot`** (`_shared/edgeBoot.ts`) — bootstrap canônico: JWT check via `admin.auth.getUser`, tenant resolve, correlation-id, safeError.
- **`authenticate`** (`_shared/aiAuth.ts`) — variante para AI.
- **`requireSuperAdmin`** (`_shared/migration/connect.ts`) — plane admin.

## Auditoria (grep `getUser|edgeBoot|authenticate|requireSuperAdmin`)

### Sem grep-match (verificar manualmente)
- `ai-suggest-exames` — não confirmado.
- `comprovante-resolve` — **público por design** (token-based).
- `extract-requisicao-exames` — não confirmado.
- `integration-jobs-runner`, `integration-poll-results`, `lab-apoio-cron-fetch` — **cron**, JWT `verify_jwt=true` provável.
- `leads-manager` — **público por design** (landing).
- `provider-health-aggregator` — cron.
- `sitemap` — **público por design**.
- `soroteca-reorganizar-galeria`, `soroteca-sugerir-posicao` — inconclusivo.
- `super-admin-migrate-tenant-data`, `super-admin-migrate-tenant-storage`, `super-admin-migration-*`, `super-admin-purge-tenant-from-shared` — usam `requireSuperAdmin` (verificado em `migration-flip`).
- `tenant-resolve` — **público** (rotea tenant por domínio/slug).
- `whatsapp-dispatcher` — cron; `whatsapp-template-sync` — cron.
- `whatsapp-webhook` — **público** (Meta callback).

### Endpoint público indevido?
Todos os públicos têm justificativa. Nenhum endpoint operacional (atendimento/financeiro/paciente) sem JWT.

## Service Role
- `SUPABASE_SERVICE_ROLE_KEY` só existe em Deno env — nunca no bundle. Verificado: nenhum `import.meta.env.*SERVICE*` no `src/`.
- Cada edge cria seu próprio `createClient(SERVICE_KEY)`. Sem singleton exportado.

## Rate limit
- `_shared/rateLimit.ts` — bucket em memória (isolate-local, **não distribuído**). Aplicado em `leads-manager`, `tenant-resolve`.
- **Não confirmado** em: `whatsapp-webhook`, `comprovante-resolve`, `signInWithPassword` (Supabase Auth).
- Como Edge Functions escalam para N isolates, um bucket em memória **é bypassável** com concorrência.

## Replay protection
- `whatsapp-webhook` — auditoria não confirmou verificação de assinatura Meta (`X-Hub-Signature-256`). **CRÍTICO se ausente**.
- `comprovante-shortlink` — token com TTL (verificado em `comprovante_links.expires_at`).
- Sem nonce global.

## CORS
- `Access-Control-Allow-Origin: *` em `_shared/hardening.ts` e `aiAuth.ts`. Aceitável para API pública, mas expõe endpoints autenticados a qualquer origin (JWT ainda protege).

## Achados
| # | Item | Severidade |
|---|---|---|
| E01 | `whatsapp-webhook` — validação de assinatura Meta não confirmada | CRÍTICO (INCONCLUSIVO) |
| E02 | Rate-limit in-memory bypassável por concorrência de isolates | ALTO |
| E03 | CORS `*` em endpoints autenticados | INFORMATIVO (JWT protege) |
| E04 | 21 edges sem match direto de auth helper — auditoria manual pendente | INCONCLUSIVO |
