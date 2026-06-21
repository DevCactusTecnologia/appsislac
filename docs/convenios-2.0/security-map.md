# Convênios 2.0 — Mapa de Segurança

## RLS (estado atual)

### `convenios`
| Cmd | Quem | Condição |
|---|---|---|
| SELECT | authenticated | `is_super_admin(auth.uid()) OR tenant_id = current_tenant_id()` |
| INSERT | authenticated | `tenant_id = current_tenant_id() AND has_role(auth.uid(),'admin')` |
| UPDATE | authenticated | idem INSERT |
| DELETE | authenticated | idem INSERT |

### `convenio_faturas`
| Cmd | Quem | Condição |
|---|---|---|
| SELECT | authenticated | `is_super_admin OR (tenant + visualizar_financeiro)` |
| INSERT | authenticated | `tenant + gestao_financeira` |
| UPDATE | authenticated | `tenant + gestao_financeira` |
| DELETE | authenticated | `tenant + admin` |

### `convenio_fatura_itens`
Idem `convenio_faturas` (4 policies cfi_*).

## Triggers críticas

| Trigger | Risco mitigado |
|---|---|
| `protect_particular_convenio` | Impede que Particular seja apagado/renomeado/desativado, evitando perda de fluxo de cobrança paciente. |
| `convenio_fatura_assign_codigo` | Garante código sequencial + único por tenant/ano. |
| `convenio_fatura_sign_codigo` | HMAC em `protocolo_auditoria` — evita falsificação de protocolo. |
| `protect_convenio_fatura_paga` | Após `paga`, valores e período são imutáveis. Só `cancelada` é permitido. |

## Riscos identificados

### 🟢 Baixos / mitigados
- **Tenant leakage**: todas policies filtram por `current_tenant_id()`; super_admin tem leitura cross-tenant explicitamente. ✅
- **Falsificação de fatura**: HMAC + `validate_protocolo_fatura` permite verificar autenticidade.
- **Edição pós-pagamento**: bloqueada por trigger.

### 🟡 Médios
- **Cancelamento sem auditoria**: `cancelarFatura` faz DELETE em `convenio_fatura_itens` sem registro de motivo nem trigger de audit. Se um operador `gestao_financeira` cancelar fatura paga (permitido pelo trigger), o lançamento desaparece da view `financeiro_entradas` sem rastro.
- **Sem coluna de "estornado"**: contraste com `atendimento_pagamentos` (que tem `status_pagamento='estornado'`). Cancelamento simplesmente apaga.
- **DELETE de itens permite reciclagem silenciosa**: itens removidos voltam a ser faturáveis sem evidência.
- **Cálculo no client (subtotal/total)**: banco aceita qualquer valor — risco se a UI for adulterada.

### 🟠 Altos
- **Divergência de critério "finalizado" vs "não-cancelado"**: pode levar a relatórios de gestão divergentes do que pode ser efetivamente faturado, gerando decisão errada.
- **Pagamento de fatura não passa por caixa**: PIX/Dinheiro recebido por convênio não entra em `caixa_sessoes` — se a operação receber direto na recepção, há descasamento entre conferência de caixa e fatura paga. Hoje é por design (Fase 5), mas é um risco operacional caso o usuário não saiba disso.
- **Sem detecção de fatura duplicada por período**: nada impede 2 faturas no mesmo período (com itens diferentes) — não é um bug, mas exige disciplina humana.

## Recomendações (sem implementar)

1. Adicionar trigger de auditoria em `convenio_faturas` (espelhando `atendimento_audit`).
2. Substituir DELETE em `convenio_fatura_itens` por marca lógica (`status` ou `estornado_em`).
3. Recalcular `subtotal/total` no banco via trigger (defesa em profundidade).
4. Padronizar critério único de elegibilidade (RPC vs front) — provavelmente `status='finalizado'` em ambos os lados.
5. Documentar explicitamente para o usuário: "fatura paga não vira lançamento de Caixa Operacional".
