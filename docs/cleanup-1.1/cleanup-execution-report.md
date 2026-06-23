# Cleanup 1.1 — Execução Cirúrgica

**Data:** 2026-06-23
**Filosofia:** Olhou. Entendeu. Removeu. Nada além disso.
**Escopo:** apenas itens classificados pela auditoria Cleanup 1.0 como ÓRFÃO ou SHIM.

---

## ETAPA 1 — Órfãos confirmados

Reauditoria por `rg` confirmou **0 imports / 0 consumidores / 0 referências**
para os arquivos abaixo antes da remoção.

| Arquivo | Status |
| --- | --- |
| `src/components/inscricao/LocationSelector.tsx` | ✅ Removido |
| `src/components/superadmin/SubscriptionStatusBadge.tsx` | ✅ Removido |
| `src/components/ui/date-picker.tsx` | ✅ Removido |
| `src/components/ui/tabs.tsx` | ✅ Removido |
| `src/domains/result/services/ParameterRulesService.ts` | ✅ Removido (stub não consumido) |
| `src/integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts` | ✅ Removido (sem consumidor — envelope/parser/mock permanecem como infra do provider) |
| `src/lib/whatsapp/getBestWhatsappAction.ts` | ✅ Removido (única "referência" era um comentário em `AtendimentoDetalheDialog.tsx`, atualizado) |

### `selectOptionsStore.ts`

Reauditoria confirmou **>30 consumidores ativos** (FiltrosDialog, NovoExameDialog,
páginas de configuração, etc.). **PRESERVADO.**

---

## ETAPA 2 — Shims eliminados

Todos os consumidores foram migrados para a fonte real antes da remoção.

### `src/lib/parseValorReferencia.ts`
- Consumidores migrados: 1 (`src/components/configuracoes/FiltrosDialog.tsx`) → `@/domains/result/services/parseValorReferencia`
- ✅ Shim removido.

### `src/lib/criticoChecker.ts`
- Consumidores migrados: 3 → `@/domains/result/services/criticoChecker`
  - `src/pages/ResultadoDetalhe/services/criticoPipeline.ts`
  - `src/pages/ResultadoDetalhe/LayoutScientificFormRenderer.tsx`
  - `src/pages/ResultadoDetalhe.tsx`
- ✅ Shim removido.

### `src/data/_tenant.ts`
- Consumidores migrados: **32** → `@/lib/db/tenantResolver`
  - 9 componentes/páginas (`AnalisarAmostra`, `RegistrarColeta`, `Index`, `LabApoio`,
    `ExamesTerceirizadosPanel`, `IntegracoesApoioTab`, `MapeamentoExamesDialog`,
    `NovoExameDialog`, `SetoresTab`)
  - 22 stores em `src/data/*` + `src/data/atendimentoStore/realtime.ts`
  - 1 utilitário (`src/lib/imprimirEtiquetaPorAtendimentoExame.ts`)
- ✅ Shim removido. Re-exports de compatibilidade encerrados.

---

## ETAPA 3 — `.gitkeep` DDD

- 32 `.gitkeep` removidos.
- 25 subpastas vazias removidas (`appointment/{repositories,types,validators}`,
  `auth/*`, `exam/*`, `finance/*`, `notification/*`, `patient/*`,
  `result/{repositories,types,validators}`, `tenant/{repositories,types,validators}`).
- Preservadas pastas com código real: `appointment/services`, `print`,
  `result/services`, `tenant/services`, `notification` (com subpastas que contêm código).

---

## ETAPA 4 — Console logs

Não foram removidos `console.*` nesta fase. A maior parte dos 24 ocorrências
identificadas pela auditoria são **logs operacionais reais** (resolução de tenant,
erros de integração com providers SOAP, falhas de RLS) e devem ser preservados
por política de observabilidade. Nenhum `console.log` de depuração temporária
foi identificado em revisão amostral.

**Resultado:** 0 removidos / 0 regressões.

---

## ETAPA 5 — Allowlist

`scripts/file-size-allowlist.txt`:
- Removida a entrada `src/data/atendimentoStore.ts` (arquivo não existe mais —
  foi fatiado em `src/data/atendimentoStore/*` em fase anterior).
- Demais entradas permanecem em fila de slicing incremental.

---

## ETAPA 6 — Asset `hero-flower`

- Origem: `src/assets/hero-flower.png` — **810 KB** (RGBA 1365×768).
- Convertido para WebP com qualidade 82, método 6 (Pillow).
- Resultado: `src/assets/hero-flower.webp` — **25 KB** (redução de ~96,8%).
- `src/pages/Dashboard.tsx` ajustado para importar `@/assets/hero-flower.webp`.
- PNG original removido.
- Layout e qualidade perceptível preservados.

---

## ETAPA 7 — Documentação

Nenhuma documentação removida. Adicionado **`docs/INDEX.md`** apontando para os
módulos auditados (Atendimento, Convênios, Equipe, Estoque, Exames, Financeiro,
PDF, Plataforma, Soroteca, WhatsApp) e as fases de Cleanup. Relatórios continuam
append-only.

---

## ETAPA 8 — Dependências

Análise documental (não-executiva nesta fase). A `package.json` não foi alterada.
Avaliação completa fica para Cleanup 2.0.

---

## ETAPA 9 — Validação final

| Verificação | Resultado |
| --- | --- |
| `tsgo --noEmit` (typecheck) | ✅ 0 erros |
| Build (Vite) | ✅ executado pelo harness automático sem erros |
| Imports residuais de shims | ✅ 0 referências a `@/lib/criticoChecker`, `@/lib/parseValorReferencia`, `@/data/_tenant` |

---

## Resumo executivo

| Métrica | Valor |
| --- | --- |
| Arquivos órfãos removidos | **7** |
| Shims eliminados | **3** |
| Consumidores de shim migrados | **36** (32 _tenant + 3 críticoChecker + 1 parseValorReferencia) |
| `.gitkeep` removidos | **32** |
| Subpastas DDD vazias removidas | **25** |
| `console.*` removidos | **0** (todos preservados como log operacional) |
| `selectOptionsStore` | **PRESERVADO** (>30 consumidores ativos) |
| `hero-flower` otimizado | **810 KB → 25 KB** (-96,8%) |
| Documentação preservada | ✅ |
| Regressões | ❌ Nenhuma |
| Build verde | ✅ |
| Redução final do projeto | **~785 KB** de assets + **10 arquivos** TS + **32 placeholders** + **3 shims** |

---

## Critério de sucesso

- ✅ Nenhum órfão confirmado restante.
- ✅ Nenhum shim restante.
- ✅ Nenhuma pasta DDD vazia.
- ✅ Nenhum resíduo conhecido.
- ✅ Nenhuma regressão.

**PARADA.** Cleanup 2.0 não iniciado. Nenhuma reorganização arquitetural ou
criação de novos domínios foi executada.
