# 05 — File Classification

Cada arquivo do repositório é classificado em uma das 16 categorias definidas na missão. Categorias não observadas são explicitamente marcadas.

## Legenda (categorias)

Apresentação, Domínio, Infraestrutura, Integração, Persistência, Configuração, Teste, Build, Script, Documentação, Utilitário, Suporte, Experimental, Legado, Temporário, Outro.

## Distribuição consolidada

| Categoria | Contagem estimada | Localização típica |
| --------- | ----------------- | ------------------ |
| Apresentação | ~320 | `src/pages/**`, `src/components/**` |
| Domínio | ~15 | `src/domains/**`, subset de `src/lib/**` (`pricing/`, `atendimentoPolicy.ts`, `criticoAudit.ts`, `regulatorio.ts`) |
| Infraestrutura | ~10 | `src/runtime/db.ts`, `src/integrations/supabase/*`, `src/lib/queryClient.ts`, `src/lib/persist.ts`, `src/lib/logger.ts`, `src/lib/ttlCache.ts`, `supabase/functions/_shared/runtime/*`, `_shared/edgeBoot.ts` |
| Integração | ~40 | `src/integrations/providers/**`, `src/integrations/contracts/**`, `supabase/functions/integration-*`, `lab-apoio-*`, `dbsync-*`, `provider-*`, `_shared/drivers/**` |
| Persistência | ~41 (stores) + 355 (migrations) | `src/data/**`, `supabase/migrations/**` |
| Configuração | ~15 | Raiz do projeto (`vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`, `postcss.config.js`, `playwright.config.ts`, `vitest.config.ts`, `vercel.json`, `next.config.js`, `components.json`, `supabase/config.toml`), `src/index.css` |
| Teste | ~8 | `src/__tests__/`, `src/test/setup.ts`, `src/lib/__tests__/`, `pages/NovoAtendimento/*.test.ts`, `pages/ResultadoDetalhe/formula.test.ts`, `supabase/functions/_shared/drivers/__tests__/`, `e2e/`, `scripts/test-*.js`, `supabase/tests/*.sql` |
| Build | ~5 | `.github/workflows/ci.yml`, `deploy-compliance.sh`, `validate-security.cjs`, `scripts/check-*.sh` |
| Script | 8 | `scripts/**` |
| Documentação | 112 | `docs/**`, `src/BEST_PRACTICES.md`, `GUIA-FINAL-DEPLOYMENT.md`, `GUIA_COMPLIANCE_IMPLEMENTACAO.md`, `LGPD_RDC_MIGRACAO_AUTOMATICA.md`, `public/llms.txt` |
| Utilitário | ~55 | Maior parte de `src/lib/**` (formatters, helpers, HTML/print, mapas) |
| Suporte | ~6 | `src/hooks/use-*`, `src/lib/utils.ts`, `src/lib/constants.ts`, `.lovable/**` |
| Experimental | 0 identificado | — |
| Legado | 0 identificado | — |
| Temporário | 0 identificado | — |
| Outro | ~10 | `public/*` (assets estáticos), `.env`, `.lovable/plan.md` |

## Regras de classificação

- **Apresentação**: arquivo que renderiza JSX ou define layout/rota.
- **Domínio**: lógica de negócio pura, sem I/O.
- **Infraestrutura**: acesso a plataforma (Supabase, PDF engine, logger, cache runtime).
- **Integração**: comunicação com sistemas externos (Hermes Pardini, DB Sync, WhatsApp Gateway, Lovable AI).
- **Persistência**: leitura/escrita direta em tabelas ou SQL.
- **Configuração**: build/tooling.
- **Teste**: `.spec.ts`, `.test.ts`, `*_test.ts`, specs Playwright, testes SQL.
- **Build/Script**: workflows CI, shell helpers.
- **Documentação**: `.md`.
- **Utilitário**: funções puras compartilhadas sem estado.
- **Suporte**: hooks simples, arquivos de conveniência, memoria interna do Lovable.

## Arquivos-âncora por categoria

- **Infraestrutura crítica**: `src/runtime/db.ts`, `src/integrations/supabase/client.ts`, `supabase/functions/_shared/runtime/db.ts`, `supabase/functions/_shared/runtime/createClient.ts`, `src/lib/queryClient.ts`, `src/lib/logger.ts`.
- **Domínio puro**: `src/domains/result/services/parseValorReferencia.ts`, `src/domains/result/services/criticoChecker.ts`, `src/lib/pricing/pricingEngine.ts`, `src/lib/atendimentoPolicy.ts`, `src/lib/atendimentoStatus.ts`.
- **Persistência**: `src/data/atendimentoStore/**`, `supabase/migrations/2026*.sql`.
- **Integração externa**: `src/integrations/providers/hermes-pardini/**`, `src/integrations/providers/dbsync/**`, `supabase/functions/lab-apoio-*`.
- **Config**: `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `supabase/config.toml`.

## Observação

Nenhum arquivo foi reclassificado, movido ou removido durante esta fase. As categorias "Experimental", "Legado" e "Temporário" foram avaliadas por nomenclatura e ausência de imports — nenhum arquivo se encaixou com evidência objetiva suficiente para tal marcação. Ver `11-dead-code-evidence.md`.
