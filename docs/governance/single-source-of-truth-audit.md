# Single Source of Truth — Audit

> Missão SISLAC Engineering Governance — Fase 1
> Apenas auditoria. Nenhuma alteração de comportamento.

## Metodologia

Mapeamos regras de negócio recorrentes em 5 domínios críticos e identificamos
em quantas camadas cada regra é replicada:

| Camada | Localização | Risco quando duplicada |
|---|---|---|
| SQL/DDL | `supabase/migrations` | Drift entre ambientes |
| RPC | `supabase/migrations` (functions) | Re-implementação em TS |
| Edge Function | `supabase/functions/*` | Lógica fora do RLS |
| Store (Zustand) | `src/data/*Store.ts` | Estado derivado divergente |
| Página React | `src/pages/*.tsx` | Render-time cálculo ad-hoc |

## 1. Status de Atendimento

| Camada | Fonte | Status |
|---|---|---|
| SQL enum/check | `atendimentos.status` (text) | ✅ canônico |
| Helper backend | `set_atendimento_status_*` triggers | ✅ deriva |
| Frontend deriva | `src/data/atendimentoStore.ts` (`deriveStatus`) | ⚠️ duplicado |
| Render badges | `StatusBadge`, vários `pages/*` | ✅ consome |

**Veredito**: regra de derivação existe em DB (trigger) **e** no store. A store
recomputa para optimistic UI. Mantém-se, mas qualquer mudança de regra DEVE
ser feita primeiro no DB e refletida no store via PR único.

**Ação preventiva**: comentário `// MIRROR OF: trigger set_atendimento_status_v2`
no topo da função `deriveStatus`.

## 2. Status Financeiros (pagamento)

| Camada | Fonte |
|---|---|
| Cálculo de saldo | `atendimento_pagamentos` sum vs `atendimento_exames.preco_aplicado` |
| Frontend recompute | `Financeiro.tsx`, `PagamentoDialog.tsx`, `atendimentoStore.totalPago()` |
| Status "pago/parcial/aberto" | derivado 3× (store, Financeiro, dialog) |

**Veredito**: 🔴 **duplicação real**. 3 lugares calculam `status financeiro` a
partir de `(total, pago)`. Risco: divergência em edge cases (estorno, juros).

**Ação preventiva**: extrair `src/lib/finance/statusPagamento.ts` com função
pura única; consumir em todos os 3 call sites. (Não fazer agora — apenas
registrar como hotspot.)

## 3. Status de Resultados

| Camada | Fonte |
|---|---|
| SQL | `atendimento_exames.status_resultado` |
| Derivação UI | `helpers.ts` em `pages/ResultadoDetalhe/` (`statusDbToUi`, `deriveStatusGeral`) |
| Page lists | `Resultados.tsx`, `ConsultarResultados.tsx` (reimplementam filtros) |

**Veredito**: ✅ resolvido na Sprint 1 (extraído para `helpers.ts`).
Listagens ainda filtram inline — aceitável (não é regra de negócio,
apenas UI).

## 4. Permissões RBAC

| Camada | Fonte |
|---|---|
| Tabela | `user_roles` |
| Função SQL | `public.has_permission(uid, perm)` |
| Frontend hook | `useAuth().hasPermission()` |
| Componente | `RequireSuperAdmin`, `PermissionDenied` |

**Veredito**: ✅ canônico. RPC server-side, frontend apenas espelha.
Regra documentada em `docs/auth.md` e `docs/IA_ARCHITECTURE_RULES.md §7`.

## 5. Tipos de Exames / Precificação

| Camada | Fonte |
|---|---|
| Catálogo | `exames_catalogo` |
| Preço por convênio | `tabela_preco_itens` |
| Fallback CBHPM/TUSS/Própria | `precificação dinâmica` (memória dedicada) |
| Resolução frontend | `tabelaPrecoStore.resolverPreco()` |
| Resolução backend | `resolveExamIntegration.ts` (apenas integração apoio) |

**Veredito**: ⚠️ 2 fontes. Preço operacional só no frontend (store). Sem
duplicação direta, mas se algum dia o backend precisar calcular preço
(faturamento, webhook), surge risco. **Não corrigir agora** — registrar.

## 6. Configurações Multi-Tenant

| Camada | Fonte |
|---|---|
| Tabela | `tenant_registry` |
| Resolver | `src/lib/db/tenantResolver.ts` + `current_tenant_id()` SQL |
| Proxy legado | `src/data/_tenant.ts` (re-export) |
| Frontend uso | NUNCA envia tenant_id |

**Veredito**: ✅ canônico e blindado. RLS + resolver + proxy legado para
compatibilidade. Documentado em `docs/IA_ARCHITECTURE_RULES.md §7`.

## Sumário

| Domínio | Status | Ação |
|---|---|---|
| Atendimento (status) | ⚠️ mirror controlado | Comentário "MIRROR OF" |
| Financeiro (pagamento) | 🔴 duplicado 3× | Extrair `lib/finance/statusPagamento.ts` (futuro) |
| Resultados | ✅ ok | — |
| RBAC | ✅ ok | — |
| Preços | ⚠️ aceitável | Monitorar |
| Multi-tenant | ✅ ok | — |

**Regras duplicadas encontradas: 1 crítica, 2 aceitáveis sob vigilância.**
