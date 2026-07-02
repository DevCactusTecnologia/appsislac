# 13 — Maintainability

## Novos módulos
- Base facilita: convenções claras, chokepoints, guards CI, `_shared/` reutilizável.
- Barreira: para tocar fluxos financeiro/atendimento/resultado, é preciso navegar arquivos de 1000–3000 LOC.

## Novos desenvolvedores
- Facilitadores: 247 `.md` de docs, `BEST_PRACTICES.md`, memórias em `.lovable/mem/`, nomenclatura consistente, TypeScript estrito.
- Dificultadores: 25 arquivos > 800 LOC, dualidade de cache (stores custom + TanStack Query), 3 caminhos históricos de acesso ao banco documentados.

## Novas integrações
- Contratos formais (`providerUI.ts`, `capabilities.ts`, `transport.ts`, `providers.ts` em `src/integrations/contracts/`).
- 2 vendors ativos (hermes-pardini, dbsync) provam o padrão.
- Ausência de mocks/fixtures para testar novos providers.

## Novos tenants
- Provisioning automatizado (`super-admin-provision-tenant-schema[-full]`).
- Runtime multi-tenant via `current_tenant_id()` + RLS em todas as tabelas.
- Suporte a "Shared → Dedicated" implementado (embora sem uso efetivo — TD-04).

## Novos laboratórios
- Multi-tenant é primeiro princípio; onboarding via wizard super-admin já existente.
- Sem impacto arquitetural adicional esperado.

## Degradação com escala
- Fase 10 apontou tetos: ~10–100 tenants sem particionamento; rate limit in-memory; ausência de APM.
- Escala de código: novo desenvolvedor produz mais rápido em `domains/`, `lib/`, `hooks/` do que em `pages/*` gigantes.

## Classificação
- Manutenibilidade **Boa** no núcleo (runtime, stores, domain, lib, hooks, _shared).
- Manutenibilidade **Regular** nas 5 páginas operacionais gigantes e nas ~60 edges que ainda não migraram para `edgeBoot`.
