# Cleanup — Phase 5: Candidatos à Remoção

Critério: **0 imports estáticos, 0 imports dinâmicos, 0 referências por
path canônico (`@/...`), 0 rotas, 0 chamadas externas**. Verificado por:

1. Script `node /tmp/dead.mjs` (parse AST-light de todos os imports).
2. `rg "from ['\"]@/<path>['\"]"` para cada candidato (0 matches).

## ✅ SEGURO (matemática-mente morto)

| Arquivo | Tipo | Consumidores | Risco | Impacto |
|---|---|---|---|---|
| `src/components/shared/StatusBadge.tsx` | Componente | 0 | Nenhum | -1 arquivo |
| `src/components/shared/Toolbar.tsx` | Componente | 0 | Nenhum | -1 arquivo |
| `src/components/superadmin/AlterarSenhaTenantDialog.tsx` | Dialog | 0 | Nenhum | -1 arquivo |
| `src/components/superadmin/NovoTenantDialog.tsx` | Dialog (substituído por `SuperAdminNovoLab`) | 0 | Nenhum | -1 arquivo |
| `src/components/superadmin/RuntimeBadge.tsx` | Componente | 0 | Nenhum | -1 arquivo |
| `src/components/superadmin/TenantLifecycleTimeline.tsx` | Componente | 0 | Nenhum | -1 arquivo |
| `src/components/superadmin/TenantSubscriptionPanel.tsx` | Componente | 0 | Nenhum | -1 arquivo |
| `src/hooks/use-select-options.ts` | Hook (substituído por `useDicionario`) | 0 | Nenhum | -1 arquivo |
| `src/hooks/useAuditLogs.ts` | Hook | 0 | Nenhum | -1 arquivo |
| `src/lib/format.ts` | Helper | 0 | Nenhum | -1 arquivo |

**Total SEGURO: 10 arquivos.**

## ⚠️ REVISAR (não remover sem decisão explícita)

| Arquivo | Motivo |
|---|---|
| `src/components/ui/card.tsx` | shadcn primitive — sem uso atual, mas remoção atrapalha DX futura. |
| `src/components/ui/command.tsx` | idem. |
| `src/components/ui/date-picker.tsx` | idem. |
| `src/integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts` | Provider Hermes-Pardini parece WIP. Lógica SOAP completa existe em paralelo. |
| `src/integrations/providers/hermes-pardini/transports/http.transport.ts` | idem (transport real, ainda não plugado). |
| `src/integrations/providers/hermes-pardini/transports/index.ts` | Barrel do diretório acima. |
| `src/domains/result/services/ParameterRulesService.ts` | Pode ser destino de futura migração. |
| `src/lib/parseValorReferencia.ts` (shim) | Re-export para retro-compat; remover só após auditar consumidores. |

## ❌ NÃO REMOVER

- Páginas, hooks, stores, components com 1+ importadores (provados).
- Entry-points (`main.tsx`, `vite-env.d.ts`, `test/setup.ts`).
- Tests `*.test.ts`.
- Assets `public/*` (servidos diretamente / SEO).
- Edge Functions — todas com invocação por nome confirmada.
