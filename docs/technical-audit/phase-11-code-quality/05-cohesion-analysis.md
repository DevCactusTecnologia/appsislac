# 05 — Cohesion Analysis

## Alta coesão (evidências)
- `src/domains/{appointment,result,tenant}/services/` — funções puras agrupadas por domínio.
- `src/data/atendimentoStore/` — dividido em 7 arquivos por preocupação (queries, mutations, realtime, exames, terceirizados, _internal, types).
- `supabase/functions/_shared/runtime/` — resolução de client, tenant e identity coesos.
- `src/integrations/providers/<vendor>/` — cada vendor auto-contido.
- `src/lib/tenantSite/`, `src/lib/whatsapp/` — subpastas por feature.

## Coesão moderada
- `src/lib/` raiz — 60+ arquivos flat misturando formatters, print engine, watermark, mapa, etiqueta. Nomes prefixados (`laudo*`, `mapa*`) sinalizam intenção, mas ausência de subpastas.
- `src/components/` raiz — muitos diálogos e utilitários misturados sem subpasta temática (subpastas existem só para `configuracoes/`, `financeiro/`, `superadmin/`, `auditoria/`, `tenant-site/`).

## Coesão baixa (evidências pontuais)
- `src/pages/ResultadoDetalhe.tsx` (3129 LOC) — engloba hidratação, fórmula, auditoria, impressão, histórico.
- `src/pages/NovoAtendimento.tsx` (2829 LOC) — mesmo padrão: 4+ subdomínios.
- `src/pages/Financeiro.tsx` (1149 LOC) — múltiplas abas.

## Módulos heterogêneos
- `src/lib/` (raiz) — heterogêneo por acumulação (evidência: 60+ arquivos flat).
- `src/pages/Index.tsx` (1310 LOC) — sem contexto do que agrega; suspeito de heterogeneidade.

## Classificação global
- Coesão **alta** em `src/data/`, `src/domains/`, `src/hooks/`, `src/components/ui/`, `_shared/`.
- Coesão **moderada** em `src/lib/` raiz e `src/components/` raiz.
- Coesão **baixa** localizada nas 5 páginas operacionais gigantes.
