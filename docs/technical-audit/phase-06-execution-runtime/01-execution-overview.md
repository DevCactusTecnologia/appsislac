# 01 — Execution Overview

Auditoria dinâmica: reconstrói **como o SISLAC executa**, sem alterar código.

## Escopo
- 20 módulos funcionais (mapeados na Fase 03).
- 483 arquivos em `src/`, 74 Edge Functions, 355 migrations, 200 RPCs/functions, 373 policies.
- Runtime cliente único: `src/runtime/db.ts` (`db` = `supabase` client). Roteamento shared vs. dedicated ocorre **fora** do cliente (novo deploy após flip). Server: `supabase/functions/_shared/runtime/createClient.ts` (chokepoint único).

## Camadas de execução observadas
1. **UI** — páginas em `src/pages/**` + componentes `src/components/**`.
2. **Hooks** — `src/hooks/**` (React Query, realtime, paginação).
3. **Stores** — `src/data/**` (TanStack Query + ttlCache; `ensureLoaded()`).
4. **Services de domínio** — `src/domains/**/services/*` e `src/pages/**/services/*`.
5. **Runtime cliente** — `src/runtime/db.ts` (resolve `tenant_id` via `profiles`, cacheia contexto, instala invalidação em `onAuthStateChange`).
6. **Cliente Supabase** — `src/integrations/supabase/client.ts` (auto-gerado).
7. **Edge Functions** — `supabase/functions/*` via `createClient` do chokepoint.
8. **RPCs `*_tx`** — ponto único de escrita transacional para atendimento, pagamento, amostra, caixa, fatura, resultado.
9. **Triggers** — auditoria (`audit_<tabela>`), `updated_at`, RBAC (`atendimento_exames_rbac_check_trg`), sequenciadores (`next_*`).
10. **RLS** — 373 policies baseadas em `current_tenant_id()`, `has_role()`, `has_permission()`, `is_super_admin()`.
11. **Realtime** — canais Supabase consumidos via `useRealtimeChannel` + `subscribeAtendimentos`.

## Padrão de execução
Todo fluxo operacional segue: **Componente → Hook/Store → runtime/db.ts → (Edge | RPC | supabase.from) → RLS/Trigger → Tabela → Realtime/Cache invalidation → UI**.

## Verdade da operação
A verdade final está sempre no **banco** (tabelas + triggers de auditoria). Stores são cache derivado; Edge Functions são coordenadores; RPCs `*_tx` são o único vetor de mutação crítica.
