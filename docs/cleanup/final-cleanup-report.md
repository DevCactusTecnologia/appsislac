# Cleanup — Final Report

Data: 2026-06-16
Escopo: Dead Code Elimination & Forensic Cleanup (Fases 0–8).

## Métricas

| Métrica | Valor |
|---|---|
| Arquivos analisados (TS/TSX) | 417 |
| Candidatos detectados (0 imports) | 22 |
| Candidatos classificados SEGURO | 10 |
| **Arquivos removidos** | **10** |
| Linhas removidas (aprox.) | ~1.100 |
| Componentes removidos | 7 |
| Hooks removidos | 2 |
| Helpers removidos | 1 |
| Stores removidas | 0 |
| Páginas removidas | 0 |
| Rotas removidas | 0 |
| Edge Functions removidas | 0 |
| Assets removidos | 0 |

## Arquivos removidos

1. `src/components/shared/StatusBadge.tsx`
2. `src/components/shared/Toolbar.tsx`
3. `src/components/superadmin/AlterarSenhaTenantDialog.tsx`
4. `src/components/superadmin/NovoTenantDialog.tsx` (substituído por página `SuperAdminNovoLab`)
5. `src/components/superadmin/RuntimeBadge.tsx`
6. `src/components/superadmin/TenantLifecycleTimeline.tsx`
7. `src/components/superadmin/TenantSubscriptionPanel.tsx`
8. `src/hooks/use-select-options.ts` (substituído por `useDicionario`)
9. `src/hooks/useAuditLogs.ts`
10. `src/lib/format.ts`

## Validação

- Build/TS verificados pelo harness após a remoção.
- Nenhum import quebrado (todos os arquivos tinham 0 importadores).
- Rotas, stores, edge functions e RPCs **intactos** (nada do banco/RLS/auth/multi-tenant tocado).

## Ganho

- −10 arquivos, ~1.100 linhas de código que ninguém consumia.
- Superfície de busca menor (auditoria, refactor, IDE).
- Painel super-admin sem componentes-fantasmas que confundiam navegação por arquivos.

## Regressões

- Encontradas: 0
- Corrigidas: 0

## Itens REVISAR (não removidos — exigem decisão de produto)

| Arquivo | Por quê não foi removido |
|---|---|
| `src/components/ui/card.tsx`, `ui/command.tsx`, `ui/date-picker.tsx` | shadcn primitives — sem uso atual, mas remoção encurta DX futura. |
| `src/integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts` | Provider Hermes-Pardini parece WIP (XML/parsers/mocks completos em paralelo). |
| `src/integrations/providers/hermes-pardini/transports/http.transport.ts` | idem. |
| `src/integrations/providers/hermes-pardini/transports/index.ts` | idem (barrel). |
| `src/domains/result/services/ParameterRulesService.ts` | Pode ser destino de migração futura. |
| `src/lib/parseValorReferencia.ts` | Shim de retro-compat para `@/domains/result/services/parseValorReferencia`. |

Pedir decisão explícita antes de remover qualquer item dessa lista.

## Filosofia aplicada

> Olhou. Entendeu. Provou. Removeu.

Toda remoção foi provada matematicamente (0 imports estáticos/dinâmicos
+ 0 referências por path canônico). Nenhum item removido por suposição.
