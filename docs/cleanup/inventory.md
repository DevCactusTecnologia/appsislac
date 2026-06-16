# Cleanup — Phase 1: Inventário Forense

Data: 2026-06-16
Escopo: `src/**`, `supabase/functions/**`, `public/**`, `src/assets/**`.

## Volumes

| Categoria | Total |
|---|---|
| Arquivos TS/TSX em `src/` | 417 |
| Páginas (`src/pages/**`) | 48 arquivos `.tsx` |
| Componentes (`src/components/**`) | ~200 |
| Hooks (`src/hooks/**`) | 17 |
| Stores (`src/data/**`) | 36 |
| Libs (`src/lib/**`) | 50 |
| Domínios (`src/domains/**`) | 8 namespaces (a maioria placeholders `.gitkeep`) |
| Edge Functions (`supabase/functions/**`) | 51 |
| Assets `public/` | 4 (`llms.txt`, `placeholder.svg`, `robots.txt`, `sitemap.xml`) |
| Assets `src/assets/` | 11 (favicon + 1 hero + 9 imagens landing) |

## Método

Script `node /tmp/dead.mjs` parseando todos imports estáticos / dinâmicos /
re-exports e resolvendo alias `@/` + relativos contra a árvore real. Para
cada arquivo registramos quem o importa. Files com zero importadores são
candidatos a análise nas próximas fases.

Limitações conhecidas:
- Edge Functions não são importadas por path (são invocadas por nome via
  `supabase.functions.invoke`). Cobertas separadamente em `usage-map.md`.
- Strings dinâmicas que viram caminhos (`route loaders`, lazy paths) são
  resolvidas porque o `App.tsx` usa `import("./pages/X")` literal.
