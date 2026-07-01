# 10 — Realtime

## Estado

- Subscription única: `subscribeAtendimentos` em `src/data/atendimentoStore/realtime.ts` — usa `sharedClient.channel(...)`.
- Proxy `db.channel(...)` sempre encaminha para shared.
- Nenhum canal aberto no client dedicated (por design; `auth:off` no dedicated).

## Efeito em Dedicated

Se `atendimentos` estiver no allowlist dedicated:
- Escrita: vai para o dedicated.
- Realtime: escuta o **shared** (que não recebeu a mudança) → **eventos jamais chegam**.

## Presence / Broadcast

Não identificado uso de presence ou broadcast custom no código atual.

## Respostas objetivas

- **Dedicated funciona?** ✗ Não. Realtime está estruturalmente ligado ao shared. Habilitar o roteamento para dedicated em `atendimentos` desliga silenciosamente a reatividade da tela de rotina/resultados.
