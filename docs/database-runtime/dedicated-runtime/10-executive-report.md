# 10 — Executive Report — Dedicated Runtime v1.0

## Estado após Slice 1 (esta fase)

Entregues:
- **Identity Layer** front + server (abstração issuer, default = Supabase Shared, trocável).
- **Server Runtime real**: `getTenantClient(tenant_id)` conecta ao projeto Dedicated via service-role cacheada; sem fail-closed.
- **Fail-safe explícito**: `MigrationBlockedError` (front + server) — nenhum fallback silencioso.
- **10 relatórios oficiais** em `docs/database-runtime/dedicated-runtime/`.

## Auditoria final (respostas objetivas)

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Dedicated está funcional? | **NÃO** — fundação pronta; data-plane (edge/RPC/storage/realtime) pendente |
| 2 | Existe dupla gravação? | **NÃO** — arquitetura sem dual-write; risco só se S2–S6 forem parciais |
| 3 | Existe fallback? | **NÃO** — `MigrationBlockedError` lançado em qualquer inconsistência |
| 4 | Existe código legado? | **SIM** — `tenant-dedicated-login-gate` (workaround) e `runtime-mode` legado em registry |
| 5 | Runtime Dedicated está concluído? | **NÃO** — 35% (fundação); v1.0 completa após Slice 6 |
| 6 | É possível vender Dedicated hoje? | **NÃO** |
| 7 | Bloqueadores restantes | Ver lista abaixo |

## Bloqueadores para FREEZE v1.0

1. Configuração JWT federation em projetos reais (docs + wizard).
2. Migração de 43 edge functions data-plane (Slices S2–S6 conforme D3=incremental).
3. `rpc_registry` + SCHEMA_MINIMO_V2 + Router de RPC.
4. `StorageRuntime.resolveBucket` + refactor de 18 call sites.
5. `getRealtimeChannel` + refactor `subscribeAtendimentos` e `useRealtimeChannel`.
6. Migration pipeline: `configure-jwt-federation`, `migrate-data`, `smoke-test`, `flip`, `monitor`.
7. Suite E2E Playwright P/M/G.
8. Guardrail CI `check-data-plane-routing.sh`.

## Escala

Após v1.0 completa, com D2 status quo (secret manual por tenant) e limite Supabase de **100 secrets por ambiente**:
- Suporta **~90 tenants dedicated** por ambiente antes de estourar o cap.
- Para escalar além: automatizar via Management API (D2 revisada) ou usar prefix rotativo.

## Slices remanescentes

| Slice | Escopo | ETA (turnos) |
|---|---|---|
| S2 | Atendimento + Identity Layer wiring + telemetria | 1–2 |
| S3 | Resultado + PDF + Assinatura | 1–2 |
| S4 | Storage runtime + Realtime runtime + Financeiro | 2 |
| S5 | Integrações + Provider + RPC registry + Migration pipeline | 2–3 |
| S6 | IA/LGPD/Soroteca/WhatsApp + Sitemap + E2E + FREEZE | 2 |

Total: **8–11 turnos de execução** para atingir v1.0.

## PARAR

Slice 1 concluído. Aguardando aprovação explícita para iniciar **Slice 2 — Atendimento + Identity Layer wiring**.
