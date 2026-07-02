# 06 — Duplication Analysis

## Evidências herdadas (fase forensic-review/07)
- Cliente Supabase: 3 caminhos coexistem (`integrations/supabase/client`, fachada `@/runtime/db`, `strategies/shared`). App usa hoje 121 via fachada, 4 diretos.
- Resolução de tenant: cliente (`tenantContext.ts`) + servidor (`SupabaseRegistryProvider`) + edge `tenant-runtime-config` — 3 leituras do mesmo `tenant_registry`.
- `MigrationBlockedError`: 2 definições (client vs server) com códigos divergentes.
- Detecção "é dedicated?": 4 pontos independentes.
- Colunas de identidade do dedicated: 3 famílias em `tenant_registry`.

## Sobreposição funcional
- `src/domains/appointment/services/pricing.ts` vs `src/lib/pricing/pricingEngine.ts` (fase-02 §14).
- `src/pages/Landing.tsx` vs `src/pages/LandingPageResponsive.tsx` — 2 landings coexistindo.
- CORS headers replicados manualmente em ~60 edges que não usam `edgeBoot.ts` (fase-07/12).
- Validação de JWT replicada em edges pré-`edgeBoot` (padrão `admin.auth.getUser(token)`).

## Duplicação em UI
- Diálogos com padrão idêntico de header/footer flat (evidência estilística, sem código compartilhado explícito em muitos arquivos).
- Padrões de busca-as-you-type reimplementados em várias páginas (não centralizados num hook único).

## Duplicação em stores
- Padrão de bootstrap (`ensureLoaded`, `subscribeRealtime`, `TTL cache`) reimplementado em cada store — 48 stores seguem o mesmo shape sem base class/utilitário compartilhado explícito além de `ttlCache.ts`.

## Quantitativo
- Duplicação **estrutural** (padrões repetidos): alta (stores, dialogs).
- Duplicação **literal de código**: baixa (a inspeção não expôs blocos copy-paste extensos além dos CORS headers).
