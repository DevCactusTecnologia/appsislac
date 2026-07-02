# 09 — Testability Analysis

## Superfície de testes existente
- 11 arquivos `.test.*` / `.spec.*` em `src/`.
- 1 spec E2E (`e2e/mapa-preview-cell-formatting.spec.ts`).
- 1 teste SQL (`supabase/tests/update_atendimento_tx_preserves_state.sql`).
- Setup: `vitest.config.ts` + `src/test/setup.ts`.
- 3 scripts JS de teste de RLS/validações (`scripts/test-*.js`).

## Testabilidade estrutural
- **Alta**: `src/domains/**/services/*`, `src/lib/pricing/`, `src/lib/*` (validators/formatters) — funções puras, sem I/O.
- **Alta**: `_shared/*` server (crypto, s3, rateLimit) — módulos isolados.
- **Média**: hooks (`usePaginatedAtendimentos`, `useDashboardKpis`) — dependem de stores singletons.
- **Baixa**: páginas operacionais gigantes — engloba I/O + UI + regra de negócio.
- **Baixa**: stores — singletons in-memory com efeitos colaterais (cache, realtime, subscribers).

## Acoplamento a ambiente
- Cliente: 121 módulos dependem do runtime → dependem indiretamente de `tenant_registry` remoto.
- Servidor: 74 edges dependem de Supabase (auth + DB) — testável via `supabase functions serve` + fixtures, não instrumentado.
- Providers externos (`hermes-pardini`, `dbsync`) protegidos por contrato + drivers — testáveis com mocks; nenhum mock encontrado.

## Efeitos colaterais observáveis
- Stores: cache TTL, realtime subscribers, backfills iniciais (`storeBoot.ts`).
- Runtime: `resolveContext` faz fetch de edge `tenant-runtime-config`.
- Print engine: manipulação de DOM/janelas para render/impressão.

## Cobertura observada
- Sem métrica de cobertura publicada.
- Ratio teste/código: 11/469 ≈ 2,3% de arquivos com testes unitários — **muito baixa**.

## Classificação
- Testabilidade **projetada** existe (chokepoints, injeção de providers em `_shared/runtime` e `identity/`).
- Testabilidade **exercida** é baixa.
