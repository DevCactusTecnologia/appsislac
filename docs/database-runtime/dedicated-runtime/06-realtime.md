# 06 — Realtime Runtime

## Status: PLANEJADO — execução no Slice 4

## Diagnóstico

`sharedClient.channel(...)` usado diretamente em:
- `subscribeAtendimentos` (`atendimentoStore/realtime.ts`)
- `useRealtimeChannel`
- Dashboards
Tenant dedicated ouve o projeto Shared — não recebe eventos das próprias tabelas (que agora ficam no Dedicated).

## Ação planejada

`src/runtime/db/index.ts`: novo helper `getRealtimeChannel(name)`:
- Se allowlist da tabela do canal inclui dedicated → usa `getDedicatedClient().channel(name)`.
- Senão → shared.

Reconexão pós-flip: `resetRuntime()` já limpa cache; adicionar broadcast interno para forçar re-subscribe dos hooks ativos (via `EventTarget` singleton).

## Rollback

Após rollback → `invalidateDedicatedCache` + `refreshContext` → hooks reassinam no shared.

## Status

| Item | Estado |
|---|---|
| Helper `getRealtimeChannel` | ✗ pendente |
| Refactor `subscribeAtendimentos` | ✗ pendente |
| Refactor `useRealtimeChannel` | ✗ pendente |
| Reconnect após flip | ✗ pendente |
