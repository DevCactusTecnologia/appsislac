# 03 — Directory Audit

Cada diretório é descrito por: objetivo aparente, contagem de arquivos, dependências principais, coesão observada.

## `src/`

- **Objetivo**: código-fonte do frontend SPA React 18 + Vite.
- **Arquivos**: 483 no total; ver relatório 01.
- **Coesão**: alta na segmentação por domínio (`components/`, `data/`, `domains/`, `hooks/`, `lib/`, `pages/`). Convive um domínio "vertical" (`domains/`) com stores horizontais (`data/`); ambos referenciados a partir de `pages/` e `components/`.

## `src/contexts/`

- **Arquivos (3)**: `AuthContext.tsx`, `MenuLayoutContext.tsx`, `SuperAdminPrefsContext.tsx`.
- **Coesão**: alta — cada arquivo expõe um único provider React.

## `src/runtime/`

- **Arquivos (1)**: `db.ts` — facade para o Supabase client + resolução de tenant.
- **Coesão**: máxima (arquivo único).

## `src/integrations/`

- **Estrutura**:
  - `supabase/` (client + types auto-gerados)
  - `contracts/` (capabilities, providers, providerUI, transport)
  - `providers/hermes-pardini/` (dto, mocks, parsers, transports, xml, ui)
  - `providers/dbsync/` (capabilities, labels, parser, status, transport, wsdl, xml, ui)
  - `providers/registry.ts` — boot único.
- **Coesão**: alta — cada provider replica a mesma partição estrutural (contracts + transports + parsers + ui).

## `src/data/` (41 entradas)

- **Objetivo**: stores de acesso a dados (leitura + mutation) por entidade, camadas de cache e realtime.
- **Coesão**: alta na convenção `*Store.ts`; `atendimentoStore/` é o único subdirectory (com 7 partes) devido ao tamanho.
- **Acoplamento**: todos os stores dependem de `src/runtime/db.ts` (indiretamente via `supabase/client`) e frequentemente de `lib/queryClient.ts`.

## `src/domains/`

- **Estrutura**: `appointment/services/`, `result/services/`, `tenant/services/`.
- **Coesão**: alta — cada `services/` expõe funções puras (pricing, comprovantes, checkers).
- **Observação**: sobreposição parcial com `src/lib/pricing/pricingEngine.ts` (pricing existe em domínio + em lib).

## `src/hooks/` (20 arquivos)

- **Coesão**: alta — cada arquivo expõe um único hook nomeado.
- **Dependências**: React + stores + libs utilitárias.

## `src/lib/` (65 entradas + subpastas)

- **Estrutura**: raiz com utilitários genéricos + subpastas temáticas (`integration/`, `pricing/`, `tenantSite/`, `whatsapp/`).
- **Coesão**: média-alta. É a área com maior amplitude temática (print, PDF, HTML, pricing, whatsapp, LGPD, mapas). Diretórios temáticos convivem com arquivos "flats" na raiz.

## `src/pages/` (78 arquivos)

- **Estrutura**: rotas na raiz + subpastas quando a rota tem componentes internos (`ResultadoDetalhe/`, `NovoAtendimento/`, `Financeiro/`, `superadmin/`, `admin/`, `producao/`).
- **Coesão**: alta; cada rota corresponde a um único arquivo `.tsx` na raiz.

## `src/components/`

- **Subdiretórios (21)**: `ui/`, `configuracoes/`, `soroteca/`, `tenant-site/`, `financeiro/`, `estoque/`, `mapa/`, `rastreabilidade/`, `superadmin/`, `shared/`, `editor/`, `dashboard/`, `operacional/`, `caixa/`, `resultado/`, `whatsapp/`, `atendimento/`, `auditoria/`, `assistente/`, `seo/`, `usuarios/`.
- **Coesão**: alta dentro de cada subdiretório. A raiz de `components/` concentra dialogs e panels que são compartilhados entre módulos.

## `src/assets/`

- Recursos estáticos importados (SVG/PNG/etc.). Não auditado individualmente (fora do escopo de código fonte).

## `src/test/`, `src/__tests__/`

- Um arquivo cada. Cobertura pontual (setup + validation spec).

## `supabase/functions/`

- **74 diretórios** funcionais + `_shared/`.
- Cada função Deno tem responsabilidade única declarada pelo nome.
- `_shared/` concentra o runtime server (`runtime/db.ts`, `runtime/createClient.ts`), engine de drivers (`drivers/`), auth AI, rate limit, crypto, S3, logs, tenant guard.
- **Coesão**: alta por função; alta dentro de `_shared/`.

## `supabase/migrations/`

- **355 arquivos SQL**, todos com prefixo `2026*`.
- Coesão temporal (execução sequencial). Sem subpastas.

## `supabase/tests/`

- 1 arquivo (`update_atendimento_tx_preserves_state.sql`).

## `scripts/`

- 8 arquivos (guards + testes RLS + backup).

## `e2e/`

- 1 spec Playwright.

## `public/`

- 4 arquivos estáticos (llms.txt, placeholder, robots, sitemap).

## `docs/`

- 9 subdiretórios temáticos, 112 arquivos `.md`.
- Coesão média — algumas iniciativas geram múltiplos ciclos de auditoria (`database-runtime/surgery/`, `database-runtime/forensic-review/`, `technical-audit/phase-01-architecture/`, `technical-audit/phase-02-source-code/`).

## Raiz do projeto

- Configuração pura + guias (`GUIA*.md`, `LGPD_RDC_*.md`, `deploy-compliance.sh`).
