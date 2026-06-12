# FASE 5 — Performance Impact Report

> Estimativa qualitativa baseada em (a) deltas de tamanho de arquivo, (b) redução de canais realtime, (c) consolidação de edge functions e (d) inspeção de dependências. **Não foram coletados números de profiler em runtime** (regra de somente-leitura).

## Tabela

| Métrica | Antes | Depois | Ganho real | Ganho percebido |
|---|---|---|---|---|
| **HMR** (hot reload em hotspots) | Slow em `Financeiro.tsx` (1541 LOC) e `NovoAtendimento.tsx` (~3200) | `Financeiro` 924; lógica de NovoAtendimento em módulos isolados | **Médio** — recompilar 924 linhas + tab tocada é ~40% mais rápido | **Médio** |
| **Build (Vite)** | 64 edge fns + 38 stores + duplicações | 52 edge fns + 32 stores + 0 duplicações | **Baixo** (Vite só compila o que muda) | **Baixo** |
| **Parsing TS** | Re-parse de orchestrators monolíticos a cada edição | Parse incremental em módulos pequenos | **Médio** | **Médio** |
| **Imports / fan-in** | `Financeiro.tsx` importava 40+ símbolos | tabs importam apenas o que usam via contexto | **Médio** | **Baixo** |
| **Dependências** | Sem mudança | Sem mudança | **Nenhum** | **Nenhum** |
| **Bundle inicial** | Code-split por rota já existia; orchestrators grandes pesavam na rota | Tabs internas ainda no mesmo chunk (não foram lazy) | **Baixo** | **Baixo** |
| **Canais Realtime ativos** | ~12 pontos de assinatura | 4 (consolidados via `useRealtimeChannel`) | **Alto** — menos sockets, menos re-renders | **Médio-Alto** |
| **Queries duplicadas** | Caches espalhados sem `queryKey` consistente | `["tenant", tenantId, ...]` em todas as queries operacionais | **Médio** — cache hit melhor, menos round-trips | **Médio** |
| **Re-renders do layout** | `key={location.pathname}` causava remount | Removido (constraint registrada) | **Alto** em navegação | **Alto** |
| **Edge functions** | 64 (algumas redundantes) | 52 | **Baixo** runtime; **Médio** em manutenção | **Baixo** |

## Resumo

| Eixo | Classificação |
|---|---|
| Ganho real geral | **Médio** |
| Ganho percebido pelo usuário final | **Médio** (principalmente em navegação e Financeiro) |
| Ganho percebido pelo dev | **Alto** (HMR + clareza de imports) |

## Oportunidades restantes (não executadas)

1. **Code-split por tab no Financeiro** (`React.lazy` em `EntradasTab`/`SaidasTab`/`AReceberTab`/`CaixaTab`) — ganho **Médio** no first paint.
2. **Lazy de wizard steps** em NovoAtendimento — ganho **Médio**.
3. Profiler real-world (Lighthouse + React Profiler) para quantificar — fora do escopo desta auditoria.
