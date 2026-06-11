# FASE 2 — Validação de Regras de Negócio

> Verificação por inspeção de código. Sem alterações.

## Novo Atendimento (`NovoAtendimento.tsx` + `src/domains/appointment/services/pricing.ts`)

| Regra | Localização | Status |
|---|---|---|
| Precificação (CBHPM/TUSS/Própria fallback) | `pricing.ts` + `tabelaPrecoStore` | ✅ Preservada |
| Convênio vs Particular | `convenioStore` + `convenios.tipo` | ✅ Preservada |
| Desconto / Acréscimo | `atendimento_pagamentos` + form wizard | ✅ Preservada |
| Recoleta (motivos) | `recoletasStore` + `recoletas_motivos` (dicionário) | ✅ Preservada |
| Exames bloqueados por terceirizada | `labApoioStore` + `IntegracoesApoioTab` | ✅ Preservada |
| Persistência via edge fn | `create-atendimento` / `update-atendimento` | ✅ Server-side com `current_tenant_id()` |

## Resultado (`ResultadoDetalhe.tsx` + `src/domains/result/*`)

| Regra | Localização | Status |
|---|---|---|
| Valores críticos | `criticoChecker.ts` (mudou de `src/lib/` para `src/domains/result/services/`, re-export OK) | ✅ |
| Limites de referência (sexo/idade) | `parseValorReferencia.ts` + `reguasEtariasStore` | ✅ |
| Assinatura digital | `assinatura-url` + `upload-assinatura` edge fns | ✅ |
| Geração PDF | `comprovantesHtml` → `comprovantesRender` (split) | ✅ Mesmo output |
| Liberação | `atendimentoStore.liberar*` + `atendimentoStatus.ts` (SSOT) | ✅ |
| Layout de impressão | **CONGELADO** (mem://constraints/layout-impressao-travado) | ✅ Não alterado |

## Financeiro

| Regra | Localização | Status |
|---|---|---|
| Caixa diário | `financeiroStore` + `Financeiro.tsx` | ✅ |
| Recebimentos (Entradas) | **read-only** via `atendimentoStore` | ✅ Integridade mantida |
| Faturas de convênio | `convenioFaturasStore` + tabelas `convenio_faturas*` | ✅ |
| Estornos | `atendimento_pagamentos` (estorno via wizard) | ✅ |
| Saídas/Despesas | `financeiro_saidas` + dicionários migrados a `useDicionario` | ✅ Read-path unificado |

## Portal do Paciente

| Regra | Localização | Status |
|---|---|---|
| OTP | `identidade_confirmacoes` + edge `comprovante-resolve` | ✅ |
| Rate limit | `public_rate_limits` + `signup_rate_limit` | ✅ |
| Protocolos públicos | `protocoloLookup.ts` + `friendly_id_counters` | ✅ |
| Download seguro | `comprovante-shortlink` + token expirável | ✅ |

## WhatsApp

| Regra | Localização | Status |
|---|---|---|
| Templates | `tenant_whatsapp_config` + `whatsapp-send` | ✅ |
| Idempotência | `whatsapp_mensagens.unique` por (tenant, ref, evento) | ✅ |
| Logs/Reenvio | `whatsapp_mensagens.status` + retry edge fn | ✅ |
| Webhook | `whatsapp-webhook` revalidando assinatura | ✅ |

**Conclusão Fase 2:** Nenhuma regra de negócio identificada como removida ou alterada. Mudanças foram exclusivamente de *posicionamento* (lib → domains) e *read-path* (stores → `useDicionario`).
