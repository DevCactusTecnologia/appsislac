# FASE 7 — Comparação com Coremas (Laravel)

> Base: `docs/audits/laravel-vs-lovable-comparativo.md` + `docs/architecture/coremas-lessons-applied.md`.

| Critério | Coremas (Laravel) | SISLAC (antes) | SISLAC (depois) | Aproximação? |
|---|---|---|---|---|
| **Banco** | MySQL, schema mono-tenant por instância | Postgres multi-tenant, RLS + `tenant_id` | Idem, com `current_tenant_id()` server-side + GRANTs explícitos | ✅ Mais rigoroso que Coremas |
| **Domínios** | Eloquent Models por contexto, services finos | Stores enormes + helpers in-line | `src/domains/<bounded-context>/{services,repositories,types,validators}` | ✅ Sim, segue filosofia Coremas |
| **Regras** | Concentradas em Services + Form Requests | Espalhadas (front + store + edge) | Concentradas em services puros + RPCs/triggers DB | ✅ Sim |
| **Fluxos** | Controllers → Services → Models → Events | Componentes React faziam de tudo | Componentes → hooks/contextos → edge fns (transação RPC) → triggers DB | ✅ Sim |
| **Serviços** | Service classes injetáveis | Funções espalhadas | Funções puras em `domains/*/services/` (testáveis) | ✅ Equivalente funcional |
| **Simplicidade** | Estilo "fat model / thin controller" | Tudo gordo | Orchestrators finos + domínios coesos | ✅ Mais próximo |
| **Multi-tenant** | Geralmente 1 DB por cliente (mais simples, menos eficiente) | 1 DB compartilhado + RLS (mais eficiente, mais arriscado) | Idem, mas RLS auditada + edge fns como controllers + super_admin isolado | ✅ **Superior em segurança**, equivalente em simplicidade percebida |
| **Segurança** | Middleware + Policies | RLS + checks no front | RLS + `has_permission` no DB + revalidação em edges + auditorias contínuas | ✅ **Superior** |
| **Escalabilidade** | Escala via mais instâncias | Escala via Postgres + edge runtime | Idem + circuit breakers (`provider_circuit_state`) + health metrics | ✅ Equivalente ou superior |

## Onde SISLAC supera Coremas

- **Realtime** nativo (Postgres + canal Supabase) — Coremas não tem.
- **RBAC granular em SQL** (`has_role` + `has_permission`) — defesa em profundidade.
- **Auditoria** estruturada (`atendimento_audit`, `operational_audit`, `platform_audit`, `storage_audit`).
- **Multi-tenant em produção** desde o dia 1, sem necessidade de provisionar instância por cliente.

## Onde SISLAC ainda fica atrás

- **Maturidade de testes automatizados** (Coremas tipicamente tem mais cobertura Pest/PHPUnit).
- **Form Requests / validators centralizados** — pastas `validators/` em `src/domains/*/` ainda vazias.
- **Documentação por feature** estilo "Laravel Docs" — começou (`docs/governance/*`) mas ainda incompleta.

## Resposta

✅ **SIM** — o SISLAC ficou significativamente mais próximo da filosofia Coremas (services finos, regras concentradas, domínios coesos), mantendo as vantagens estruturais do stack atual (multi-tenant real, realtime, edge functions transacionais).
