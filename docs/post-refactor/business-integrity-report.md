# FASE 1 — Business Rules Integrity Report

> Modo: somente leitura. Validação por inspeção de código + cruzamento com auditorias prévias (`docs/post-refactor/business-rules-validation.md`, `docs/audits/**/*-business-rules.md`).

## Resumo

| Módulo | Regras idênticas? | Observação |
|---|---|---|
| Novo Atendimento | ✅ SIM | Lógica preservada — extrações foram puras |
| ResultadoDetalhe | ✅ SIM (sem alteração funcional) | Layout de impressão congelado por constraint |
| Financeiro | ✅ SIM | Read/write paths inalterados |
| Portal do Paciente | ✅ SIM | OTP, rate limit, protocolo, shortlink intactos |
| WhatsApp | ✅ SIM | Templates, idempotência e retry preservados |

---

## 1. Novo Atendimento — **SIM, regras idênticas**

| Regra | Localização atual | Status |
|---|---|---|
| Paciente (cadastro/uniqueness por CPF) | `pacienteStore` + form wizard | ✅ |
| Convênio vs Particular | `convenioStore` + `resolveCobrancaDefault` (`pages/NovoAtendimento/helpers.ts`) | ✅ |
| Precificação (CBHPM / TUSS / Própria fallback) | `src/domains/appointment/services/pricing.ts` (SSOT) | ✅ Substitui 4 cópias in-line |
| Desconto / Acréscimo | wizard → `atendimento_pagamentos` (via RPC `create_atendimento_tx`) | ✅ |
| Recoleta (motivos) | `recoletasMotivosStore` + dicionário | ✅ |
| Exames bloqueados por terceirizada | `labApoioStore` | ✅ |
| Persistência | edge fn `create-atendimento` + `update-atendimento` (tx + RBAC `has_permission`) | ✅ Endurecido (P0) |
| Etiquetas | `pages/NovoAtendimento/services/contarEtiquetas.ts` | ✅ Comportamento literal |
| Re-sync cobrança ao trocar convênio | `pages/NovoAtendimento/services/resyncCobrancaConvenios.ts` | ✅ Comportamento literal |
| Payload de cobrança | `buildExamesCobranca.ts` (com testes) | ✅ Substitui 2 cópias idênticas |

**Resposta:** ✅ **SIM** — as regras permanecem idênticas. Mudanças foram exclusivamente de posicionamento (lib → domains/services) e deduplicação. Hardening de segurança (RBAC server-side) **adicionou** validação sem alterar comportamento funcional.

---

## 2. ResultadoDetalhe — **NÃO há alteração funcional**

| Regra | Localização | Status |
|---|---|---|
| Valores críticos | `src/domains/result/services/criticoChecker.ts` (+ shim `src/lib/criticoChecker.ts`) | ✅ |
| Referências (sexo/idade) | `parseValorReferencia.ts` + `reguasEtariasStore` | ✅ |
| Assinatura digital | edge fns `assinatura-url` / `upload-assinatura` | ✅ |
| Geração PDF | `comprovantesHtml` → split em `comprovantesRender` / `comprovantesValidation` / `comprovantesUpload` / `comprovantesWhatsapp` | ✅ Output idêntico |
| Liberação | `atendimentoStore.liberar*` + `atendimentoStatus.ts` (SSOT) | ✅ |
| Auditoria | `criticoAudit` + `pdf_override_audit` | ✅ |
| Layout de impressão | **CONGELADO** (`mem://constraints/layout-impressao-travado`) | ✅ |

**Resposta:** ✅ **NÃO** — não existe alteração funcional. Apenas split de arquivo e re-export shim. Comportamento bit-a-bit equivalente.

---

## 3. Financeiro — **NÃO houve mudança de regra**

| Regra | Localização atual | Status |
|---|---|---|
| Caixa diário | `financeiroStore` + `Financeiro/components/CaixaTab.tsx` | ✅ |
| Entradas (Recebimentos) | **read-only** via `atendimentoStore` + view `financeiro_entradas` | ✅ Constraint preservada |
| Faturas de convênio | `convenioFaturasStore` + tabelas `convenio_faturas*` | ✅ |
| Estornos | `atendimento_pagamentos` (estorno via wizard de pagamento) | ✅ |
| Saídas / Despesas | `financeiro_saidas` + dicionários `useDicionario` | ✅ |
| Status de pagamento (SSOT) | `atendimentos.status_pagamento` via trigger `recompute_atendimento_status` | ✅ |
| Relatórios (Livro Caixa) | `imprimirLivroCaixa` mantido no contexto | ✅ |

**Notas residuais (não-regressão):** continuam pendentes (eram pré-existentes e estão documentadas em `docs/audits/financeiro/financeiro-single-source-of-truth.md`):
- R-01: legacy A-Receber lê `tabelaPrecoStore` em vez de `atendimento_exames.valor`.
- R-05: forma de pagamento de saída codificada em `descricao` (`[pgto:X]`).

**Resposta:** ✅ **NÃO** — nenhuma regra financeira foi alterada. O split do `Financeiro.tsx` (1541 → 924 linhas) foi puramente estrutural via `FinanceiroContext` + `EntradasTab`/`SaidasTab`/`AReceberTab`/`CaixaTab`.

---

## 4. Portal do Paciente — **NÃO houve mudança de regra de acesso**

| Regra | Localização | Status |
|---|---|---|
| OTP | `identidade_confirmacoes` + edge `comprovante-resolve` | ✅ |
| Rate limit | `public_rate_limits` + `signup_rate_limit` | ✅ |
| Protocolos públicos | `protocoloLookup.ts` + `friendly_id_counters` | ✅ |
| Download seguro | `comprovante-shortlink` + token expirável | ✅ |

**Resposta:** ✅ **NÃO** — regras de acesso intactas.

---

## 5. WhatsApp — **NÃO houve mudança de automação**

| Regra | Localização | Status |
|---|---|---|
| Templates | `tenant_whatsapp_config` + edge `whatsapp-send` | ✅ |
| Idempotência | `whatsapp_mensagens.unique (tenant, ref, evento)` | ✅ |
| Reenvios | `whatsapp_mensagens.status` + retry edge fn | ✅ |
| Webhook | `whatsapp-webhook` revalidando assinatura | ✅ |

**Resposta:** ✅ **NÃO** — automações preservadas.

---

## Veredito Fase 1

✅ **Todas as regras de negócio dos 5 módulos críticos foram preservadas.** Nenhuma regressão funcional identificada por inspeção. Mudanças foram exclusivamente:
1. Reposicionamento (`lib/` → `domains/<bounded-context>/services/`).
2. Deduplicação (SSOT helpers).
3. Splits de arquivos grandes em componentes consumindo contextos.
4. Hardening (RBAC server-side adicional, sem alterar caminhos felizes).
