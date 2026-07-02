# 08 — Complexity Metrics

Notas em escala 0–10 (0 = ausente, 10 = ideal), baseadas exclusivamente em evidências deste repositório.

| Item | Nota | Justificativa | Evidência |
|---|---:|---|---|
| **Coesão** | 7 | Módulos operacionais bem agrupados por domínio (`pages/Financeiro/**`, `components/configuracoes/**`, `providers/*`). Áreas menos coesas: `data/atendimentoStore/` e `src/lib` (mistura utilitários genéricos com serviços pesados de impressão/laudo). | `find src/data src/lib`; 39 stores; 60+ arquivos em `src/lib` |
| **Acoplamento** | 5 | Stores atuam como hub central compartilhado por várias páginas; fan-in de `integrations/supabase/client` e `runtime/db` é alto. Contudo, o acoplamento entre features (Financeiro ↔ Atendimento ↔ Resultados) segue direção lógica única. | `06-dependency-map.md` |
| **Modularidade** | 7 | Separação clara Frontend / Runtime / Backend. Sub-domínios promovidos (`src/domains/*`) coexistem com stores legados. Edge functions bem particionadas (74 unidades). | `find src/domains -type f`; 74 subdiretórios em `supabase/functions` |
| **Legibilidade** | 7 | Nomenclatura pt-BR consistente para domínio (atendimento, coleta, análise, laudo). `lazy` + `Suspense` deixam `App.tsx` legível apesar dos 474 LOC. Comentários em português orientam boot pós-auth, dedupe, cleanup SW. | `head src/App.tsx`; `head src/main.tsx` |
| **Organização** | 7 | Layout de pastas convencional (pages/components/hooks/data/lib/contexts). Presença de `src/domains` sinaliza intenção de layered DDD sem completar migração. | `ls src` |
| **Responsabilidades** | 6 | Ver `07-responsibility-analysis.md`. Grande parte dos módulos possui SRP. Concentrações claras em `atendimentoStore`, `AppSidebar` (navegação + lógica condicional) e páginas wizard. | Relatório 07 |
| **Escalabilidade** | 7 | Suporta multi-tenant real (RLS + `current_tenant_id`) e runtime dedicated per-tenant (`runtime/db.ts` + `tenant_registry` + migração automatizada em 24 edge functions). Cursor pagination adotada em pacientes/atendimentos (memory). Cache com TTL (`ttlCache`). | `src/runtime/db.ts`; edge functions `super-admin-migrate-*` |
| **Manutenibilidade** | 6 | Base ampla (469 arquivos, 124k LOC + 16k LOC em functions + 355 migrations). CI local com `check-no-mocks`, `check-file-size`, `typecheck`, `lint`, `test`. Documentação técnica extensa em `docs/`. Débito: arquivos raiz de conveniência (`GUIA-*`, `LGPD_*`, `next.config.js` não usado, `bun.lock` + `package-lock.json` coexistindo). | `package.json`; `ls /`; `docs/` |

### Métricas quantitativas (para contexto)

- Arquivos TS/TSX em `src/`: **469** (124.915 LOC)
- Pages: **114**
- Components: **160**
- Stores: **39**
- Hooks: **20**
- Contextos: **3**
- Edge functions: **74** (16.298 LOC)
- Migrations SQL: **355**
- Domains sub-arquivos: **9**
- Providers de integração: **2** (dbsync, hermes-pardini)
- Rotas React Router declaradas: **~120**
- Documentação em `docs/`: **9 subpastas** de programas maiores
