# Cleanup — Phase 2: Mapa de Uso

Classificação automática (script `dead.mjs`) confirmada via `rg` por nome
canônico do módulo (`from "@/path"`).

## 🟢 Em uso (resumo)

- 100% das 48 páginas listadas em `src/App.tsx` são alcançáveis por rota
  (lazy `import()` literal).
- Todas as 36 stores em `src/data/**` têm ao menos 1 importador
  (verificado por `rg "@/data/<store>"`).
- Todos os 51 Edge Functions têm pelo menos uma invocação por nome em
  `src/**` (verificado por `rg "functions.invoke\(\"<nome>\""`) — exceto
  os listados abaixo, que ficam como 🟡.

## 🟡 Suspeitos (precisam revisão humana, NÃO remover sem aprovação)

| Arquivo | Observação |
|---|---|
| `src/integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts` | Service público do provider Hermes-Pardini. Funções SOAP relacionadas (`verificarRecebimentoPedido`) aparecem em parsers/envelopes/mocks/transports, mas o service em si não é chamado pelo `registry.ts`. Pode ser feature em desenvolvimento. |
| `src/integrations/providers/hermes-pardini/transports/http.transport.ts` | Mesma situação — transport real (não mock) sem consumidor. |
| `src/integrations/providers/hermes-pardini/transports/index.ts` | Barrel só re-exporta `mock.transport`. Sem consumidor explícito. |
| `src/domains/result/services/ParameterRulesService.ts` | Sem importadores; lógica de regras de parâmetro pode estar duplicada em `parseValorReferencia` / `valoresReferenciaStore`. |

## 🔴 Sem uso comprovado (0 importadores em toda a árvore)

| Arquivo | Tipo |
|---|---|
| `src/components/shared/StatusBadge.tsx` | Componente |
| `src/components/shared/Toolbar.tsx` | Componente |
| `src/components/superadmin/AlterarSenhaTenantDialog.tsx` | Dialog |
| `src/components/superadmin/NovoTenantDialog.tsx` | Dialog (substituído por página `SuperAdminNovoLab`) |
| `src/components/superadmin/RuntimeBadge.tsx` | Componente |
| `src/components/superadmin/TenantLifecycleTimeline.tsx` | Componente |
| `src/components/superadmin/TenantSubscriptionPanel.tsx` | Componente |
| `src/components/ui/card.tsx` | shadcn primitive |
| `src/components/ui/command.tsx` | shadcn primitive |
| `src/components/ui/date-picker.tsx` | shadcn primitive |
| `src/hooks/use-select-options.ts` | Hook (substituído por `useDicionario`) |
| `src/hooks/useAuditLogs.ts` | Hook |
| `src/lib/format.ts` | Helper |

## Fora do escopo (manter sempre)

- `src/main.tsx` — entry-point do Vite.
- `src/vite-env.d.ts` — ambient types.
- `src/test/setup.ts` — setup vitest (referenciado por `vitest.config.ts`).
- `src/pages/NovoAtendimento/*.test.ts` — testes (executados pelo vitest).
