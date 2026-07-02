# 04 — Edge Functions Performance

## Inventário

- **74 edge functions** (`ls supabase/functions`).
- Runtime: Deno isolates (ephemeral, cold start por região/instância).
- Bootstrap comum: `_shared/edgeBoot.ts`, `_shared/migration/connect.ts` (Fase 07 §07).

## Cold start

- Deno Deploy cold start típico: 50-300ms (fora do controle do app).
- Cada handler chama `createClient(URL, KEY)` — sem singleton exportado (Fase 09 §08). Custo: alocação de fetch client por request. Aceitável para isolate ephemeral (não há reuso garantido entre invocações).

## Dependências

- `@supabase/supabase-js` em todas.
- `_shared/*` reduz duplicação; sem tree-shaking evidente por edge.
- Gemini (`ai-chat`, `ai-suggest-exames`), PIX libs (`create-atendimento`), Paged.js (renderização client — não edge).

## Reuso

- Módulos `_shared` importados por múltiplas edges — reduz superfície de manutenção, não afeta cold start (bundle por edge).

## Concorrência

- Deno Deploy escala automaticamente por request. Sem `--max-instances` configurável no config visível.
- Rate-limit `_shared/rateLimit.ts` in-memory → **não coordenado entre isolates** (Fase 09).

## Timeouts

- Timeout default Supabase edge: 60s (não redefinido em `config.toml`).
- Long-running: `super-admin-migrate-tenant-data`, `super-admin-migrate-tenant-storage`, `super-admin-tenant-backup` — evidência de execução assíncrona (memory de migração).

## Achados

| # | Item | Severidade |
|---|---|---|
| E01 | Sem singleton de client Supabase por isolate — alocação por request | BAIXO |
| E02 | Rate-limit in-memory bypassable por concorrência | ALTO (repetido de Fase 09) |
| E03 | Sem métrica de cold start / p95 exposta | INCONCLUSIVO |
| E04 | Sem controle explícito de max concurrent invocations | INCONCLUSIVO |
