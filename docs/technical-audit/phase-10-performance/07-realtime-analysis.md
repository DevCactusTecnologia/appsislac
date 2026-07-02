# 07 — Realtime Analysis

## Consumo

- **7 arquivos** em `src/` importam `useRealtimeChannel` / `postgres_changes`.
- Hook central: `src/hooks/useRealtimeChannel.ts`.
- Assinantes identificados via memory / fases anteriores: `atendimentoStore/realtime.ts`, telas de Mapa/Produção/Resultados, Dashboard, Superadmin migration timeline.

## Publicadores

- Postgres publica `postgres_changes` (WAL logical) para tabelas com REPLICA IDENTITY configurada — não enumeradas nesta fase.
- Sem publisher aplicacional (broadcast/presence) confirmado no grep.

## Contenção

- Realtime Cloud-managed — escala independente de Postgres.
- **Filtro por tenant no canal**: não confirmado — RLS server-side é a defesa (Fase 09 §07 — broadcast/presence não auditado).

## Broadcast excessivo

- Auditoria dupla e finalização de atendimento disparam updates → cada assinante ativo recebe. Sem debounce documentado no hook.
- Tabelas hot (audit_logs 13k) — se publicadas via Realtime, geram alto tráfego. Não confirmado se `audit_logs` está na publication `supabase_realtime`.

## Achados

| # | Item | Severidade |
|---|---|---|
| RT01 | Publication `supabase_realtime` não enumerada — tabelas expostas desconhecidas | INCONCLUSIVO |
| RT02 | Sem debounce/coalescing de eventos no hook | BAIXO |
| RT03 | Broadcast/Presence sem enforcement por tenant | ALTO (repetido) |
