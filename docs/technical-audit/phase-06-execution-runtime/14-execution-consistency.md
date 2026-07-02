# 14 — Execution Consistency

## Existe padrão único?
**Sim, com desvios explicáveis.**

### Padrão dominante
- Componente → Hook/Store → runtime/db → (Edge|RPC|from) → RLS/Trigger → Realtime → UI.
- QueryKey sempre prefixada por `["tenant", tenantId, ...]`.
- Escrita crítica sempre em RPC `*_tx`.
- Auditoria sempre via trigger.
- Server-side sempre via `_shared/runtime/createClient`.

### Desvios legítimos
- **Cadastros simples**: pulam Edge/RPC — vão direto `supabase.from` (protegido por RLS).
- **Super Admin**: chama edges com service-role diretamente, sem passar por stores.
- **Público**: pula AuthContext; usa `anon` + rate limit.
- **Integrações**: usam driver + pipeline próprio (`_shared/drivers`).

### Evidências de coerência
- `check-data-plane-routing.sh` bloqueia writes diretos em tabelas críticas.
- `check-no-mocks.sh` bloqueia mocks em produção.
- 100% das edges usam o chokepoint (Fase C auditou).
- Nenhum path duplo de escrita crítica identificado.

Conclusão: **arquitetura coerente**, com exceções documentadas e verificáveis.
