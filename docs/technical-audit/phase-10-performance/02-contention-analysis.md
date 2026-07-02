# 02 — Contention Analysis

## Single Points of Failure

| SPOF | Evidência | Impacto |
|---|---|---|
| Projeto Supabase único (shared) | `.env` — 1 URL, 1 anon key | Falha do projeto = falha global |
| Função `current_tenant_id()` | Chamada em 373 policies (Fase 09 §04) | Regressão = quebra RLS em massa |
| `SUPABASE_SERVICE_ROLE_KEY` global | Usada em 74 edges | Rotação sem coordenação = downtime |
| Singleton `supabase` client no front | `src/integrations/supabase/client.ts` | Troca de tenant no browser não recria transport (documentado em `db-per-tenant-audit/08`) |
| `LOVABLE_API_KEY` (ai-chat, ai-suggest, ai-transcribe, ai-speak) | Única chave AI Gateway | Falha = 4 features degradam |
| `whatsapp-webhook` público | verify_jwt=false | Único ponto de entrada de eventos WhatsApp |

## Locks / Concorrência

- **RPCs `*_tx`** usam `SELECT ... FOR UPDATE`/`BEGIN` — locks pontuais em `atendimentos`, `atendimento_pagamentos`, `caixa_sessoes` (Fase 07).
- `guia_sequence` — tabela dedicada de sequência, escrita serializada por tenant. Contenção teórica sob picos de emissão.
- Triggers: 211 no schema public — cada INSERT/UPDATE em tabela hot dispara cadeia.

## Filas

- `whatsapp_outbox` (tabela) — despacho async via `whatsapp-dispatcher`. Sem DLQ formal.
- `integration_jobs` — processada por `integration-jobs-runner`. Retry documentado em Fase 07.
- **Nenhum broker externo** (Kafka/SQS/Rabbit). Fila = tabela Postgres.

## Contadores globais

- `public_rate_limits` / `tenant_rate_limit` — in-memory + tabela; bypassable por concorrência de isolates (Fase 09 §07).
- `signup_attempts` — anon insert.

## Dependências únicas

- Lovable Cloud (compute + Postgres + Storage + Auth + Realtime — todos no mesmo tenant infra).

## Sem sugerir soluções — apenas inventário.
