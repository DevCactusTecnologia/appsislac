# 04 — Coupling Analysis

## Chokepoints (baixo acoplamento por design)
- Cliente: 121 arquivos importam `@/runtime/db` (única fachada). Apenas 4 arquivos importam `@/integrations/supabase/client` (exceções auditadas: `client.ts`, `resolver.ts`, `strategies/shared.ts`, `validarCredenciaisAnalista.ts`).
- Servidor: 76 edges (de 74 diretórios + subutilidades) importam `_shared/runtime/*`.
- Guardrail em CI: `scripts/check-data-plane-routing.sh` + regra ESLint `no-restricted-imports`.

## Matriz de dependências (macro)
| De → Para | Evidência |
|---|---|
| `src/pages/*` → `src/data/*Store` | Padrão dominante (via imports diretos) |
| `src/pages/*` → `src/components/*` | Composição de UI |
| `src/data/*Store` → `@/runtime/db` | Chokepoint único |
| `src/components/*` → `src/data/*` | Diálogos operacionais chamam stores |
| `src/domains/**/services/*` → puros | Sem deps de UI |
| `supabase/functions/*` → `_shared/*` | 76/74 edges |
| `supabase/functions/*` → `_shared/runtime/db` | Roteamento tenant-aware |

## Dependências circulares
- Nenhuma detectada em auditoria anterior (`forensic-review/03-dependency-map.md`); nenhuma nova evidência.

## Dependências ocultas / cross-layer
- Diálogos (`components/*Dialog.tsx`) chamam stores diretamente — mistura UI ↔ camada de dados. Evidência: `PagamentoDialog.tsx`, `AtendimentoDetalheDialog.tsx`, `SolicitarRecoletaDialog.tsx`.
- `src/data/atendimentoStore/*` acessa cache + realtime + I/O no mesmo pacote (dividido em 7 arquivos por preocupação).
- `_shared/runtime/db.ts` conhece diretamente colunas de `tenant_registry` (mesmo dado lido por `_shared/migration/connect.ts` e edge `tenant-runtime-config`) — 3 leitores independentes (fase forensic-review/07).

## Acoplamento externo
- 11 dependências externas auditadas na fase 10.
- Providers de integração isolados em `src/integrations/providers/<vendor>/` e `_shared/drivers/<vendor>/` — contrato único (`providerUI.ts`, `pipeline.ts`).

## Classificação
- Acoplamento **direcional e baixo** entre camadas.
- Acoplamento **médio** em diálogos operacionais (UI ↔ store).
- Sem ciclos.
