# 15 — Executive Summary

## Escopo

Auditoria de inventário e responsabilidade do código-fonte do SISLAC. Nenhum arquivo foi alterado, criado, movido ou removido.

## Números

- **483 arquivos** em `src/` (227 TS, 242 TSX).
- **107 arquivos TS** em `supabase/functions/` distribuídos em **74 edge functions** + `_shared/`.
- **355 migrations SQL**.
- **112 documentos** em `docs/`.
- **8 scripts**, **1 spec E2E**, **1 teste SQL**.
- **168.829 LOC** totais (124.915 frontend + 16.298 edge + 27.616 migrations).

## Módulos identificados

20 módulos funcionais: Core/Bootstrap, Auth, Atendimentos, Coleta/Análise, Resultados/Laudos, Configurações, Financeiro, Mapa/Produção, Estoque, Soroteca, Rastreabilidade/Auditoria, Integrações Laboratoriais, Super Admin, Migração Runtime, IA, WhatsApp, Tenant Site, LGPD/Compliance, Landing/Marketing, Utilitários compartilhados.

## Diretórios auditados

- **`src/`** com 13 subdiretórios principais.
- **`supabase/`** com `functions/` (74 funcs + `_shared/`), `migrations/` (355), `tests/` (1).
- **`scripts/`**, **`e2e/`**, **`public/`**, **`docs/`** (9 subdiretórios).
- Raiz com 15+ arquivos de configuração.

## Achados objetivos (sem recomendações)

1. **Chokepoints únicos**: `src/runtime/db.ts` (frontend) e `supabase/functions/_shared/runtime/createClient.ts` (server) concentram acesso ao Supabase.
2. **Hub de dados**: `src/data/atendimentoStore/index.ts` é o store com maior número de consumidores.
3. **Engine de laudo**: `src/lib/laudoTemplate.ts`, `laudoLayout.ts`, `laudoResolver.ts`, `laudoBatchPdf.ts`, `documentoRenderer.ts` operam em conjunto — responsabilidade única em cada arquivo, PARCIAL como conjunto.
4. **Sobreposição estrutural**:
   - `src/domains/appointment/services/pricing.ts` e `src/lib/pricing/pricingEngine.ts`.
   - `src/pages/Landing.tsx` e `src/pages/LandingPageResponsive.tsx`.
   - `next.config.js` na raiz apesar de o stack ser Vite.
5. **Diretórios com heterogeneidade temática**: `src/lib/` (40+ arquivos raiz com múltiplos temas) e raiz de `src/components/` (~37 dialogs/panels transversais sem sub-pasta).
6. **Sub-diretórios de baixa densidade**: `src/components/{atendimento,auditoria,assistente,seo,usuarios}/` contêm apenas 1 arquivo cada.
7. **Governança**: guards ativos em CI (`scripts/check-file-size.sh`, `check-no-mocks.sh`, `check-data-plane-routing.sh`, `validate-security.cjs`) + regras congeladas em `docs/database-runtime/surgery/11-core-freeze-rules.md`.
8. **Migrations sem subagrupamento**: 355 arquivos flat em `supabase/migrations/` (padrão da CLI).

## Veredito descritivo

O código do SISLAC apresenta **Boa organização**, com evidências consistentes de:

- Nomenclatura uniforme e módulos coesos por entidade/função.
- Facades e singletons bem definidos.
- Cobertura de testes pontual (não sistemática).
- Pontos localizados de heterogeneidade (libs/componentes raiz, duplicidades pontuais).

Nenhuma alteração foi proposta. Toda evidência quantitativa foi obtida via `find`/`wc -l` e leitura estrutural.

---

PHASE 02 — SOURCE CODE INVENTORY COMPLETED

Arquivos auditados: 483 (src) + 107 (edge functions) + 355 (migrations) + 8 (scripts) + 1 (e2e) + 4 (public) + 112 (docs) + 15+ (config raiz)
Diretórios auditados: 13 principais em `src/` + 21 sub em `components/` + 7 sub em `pages/` + `supabase/{functions,migrations,tests}` + `scripts/` + `e2e/` + `public/` + `docs/*`
Módulos auditados: 20
Relatórios gerados: 15

STATUS:

AGUARDANDO GATE REVIEW

PARAR.
