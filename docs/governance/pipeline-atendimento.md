# Pipeline Oficial de Atendimento (P1 — Fase 3)

> Data: 2026-06-15 · Documentação somente. Nenhuma RPC/Edge/Trigger alterada.

## 1. Visão

```
Recepção → Paciente → Exames → Precificação → Pagamento → Persistência → Auditoria → Resultado → Liberação → Entrega → Financeiro
```

## 2. Etapas

### 1) Recepção
- **Entrada:** sessão autenticada (`AuthContext`), tenant via `current_tenant_id()`.
- **Saída:** wizard `NovoAtendimento` montado, draft em memória.
- **RPC:** — · **Trigger:** — · **Edge:** — · **Auditoria:** `audit_logs` (login propagado).

### 2) Paciente
- **Entrada:** CPF/nome (busca-as-you-type) ou novo cadastro.
- **Saída:** `paciente_id`.
- **Tabelas:** `pacientes`.
- **RPC:** `lookup_paciente_publico` (portal) · INSERT direto via RLS no admin.
- **Trigger:** `audit_pacientes` · **Auditoria:** `audit_logs`.

### 3) Exames
- **Entrada:** seleção do catálogo (`exames_catalogo`), por unidade/setor.
- **Saída:** lista `ExamePayload[]` (nome, material, cobrança, lab apoio, solicitante).
- **Trigger preparado:** `trg_snapshot_exame_terceirizado` (em INSERT real depois).

### 4) Precificação
- **Entrada:** exames + convênio/tabela.
- **Saída:** `valor` por exame congelado (snapshot).
- **Fonte:** `tabelaPrecoStore` → `atendimento_exames.valor` (SSOT após persistência).
- **Regras:** CBHPM → TUSS → Própria (ver `mem://features/atendimento/precificacao-dinamica`).

### 5) Pagamento
- **Entrada:** formas de pagamento + valores parciais.
- **Saída:** array `PagamentoPayload[]`.
- **Tabela alvo:** `atendimento_pagamentos`.
- **UI:** `PagamentoDialog.tsx`.

### 6) Persistência (CORE)
- **Edge Function:** `create-atendimento` (criação) · `update-atendimento` (mutação).
- **RPC transacional:** `create_atendimento_tx` · `update_atendimento_tx`.
- **Garantias:** BEGIN/COMMIT/ROLLBACK Postgres; RLS via JWT do chamador; RBAC server-side via `has_permission()` (ver `supabase/functions/update-atendimento/index.ts:54-72`).
- **Tabelas afetadas:** `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`.
- **Triggers acionadas:**
  - `trg_atendimento_assign_protocolo` + `trg_atendimento_sign_protocolo` (numeração imutável)
  - `recompute_status_on_exame` / `recompute_status_on_pagamento` → atualizam `status_atendimento` + `status_pagamento`
  - `trg_atendimento_exames_snapshot_regulatorio` (snapshot CBHPM/TUSS)
  - `trg_require_just_*` (justificativa obrigatória pós-finalização)

### 7) Auditoria
- **Genérica:** `audit_trigger()` → `audit_logs` (todas as mutações).
- **Específica:** `audit_atendimentos`, `audit_atendimento_exames`, `audit_atendimento_pagamentos` → `atendimento_audit` (dossiê tipado).
- **Cross-DB:** `atendimento_audit_fwd` → forward para platform/operational.
- Ver `docs/governance/auditoria-duplicada-mapa.md` (todas obrigatórias).

### 8) Resultado
- **Entrada:** valores digitados (CKEditor / parâmetros).
- **Tabela:** `atendimento_exames` (campos de resultado).
- **Validação clínica:** ver `mem://features/resultados/validacao-clinica`.
- **Trigger:** `recompute_status_on_exame` recalcula status.

### 9) Liberação
- **Entrada:** validação por usuário com permissão `liberar_resultado`.
- **Saída:** `status_atendimento = 'Resultado Liberado'`.
- **Auditoria:** `audit_atendimentos` + `audit_logs`.

### 10) Entrega
- **Tabela:** `resultados_entregas` · `comprovante_links`.
- **Canais:** Portal (`tenant_pages`), WhatsApp (`whatsapp_mensagens`), Print (ResultadoDetalhe — layout travado).

### 11) Financeiro
- **Leitura:** view `financeiro_entradas` (deriva de `atendimentos.status_pagamento`).
- **A-Receber:** RPC `a_receber_pacientes_page`.
- **SSOT status:** ver `docs/governance/status-financeiro-ssot.md`.
- **Entradas:** READ-ONLY (driven by `atendimentoStore`).

## 3. Matriz consolidada

| Etapa | RPC | Edge | Trigger principal | Auditoria |
|---|---|---|---|---|
| Persistência criação | `create_atendimento_tx` | `create-atendimento` | `recompute_status_*` | `audit_logs` + `atendimento_audit` |
| Persistência update | `update_atendimento_tx` | `update-atendimento` | `recompute_status_*` + `trg_require_just_*` | idem |
| Pagamento | (via update) | `update-atendimento` | `recompute_status_on_pagamento` | `audit_atendimento_pagamentos` |
| Resultado | (via update) | `update-atendimento` | `recompute_status_on_exame` | `audit_atendimento_exames` |
| Liberação | (via update) | `update-atendimento` | — (campo status) | `audit_atendimentos` |
| Entrega | — | edge específicas (WhatsApp/portal) | — | `audit_logs` |

## 4. Garantias arquiteturais
- **Tenant isolation:** `current_tenant_id()` em cada policy; JWT propagado pela Edge.
- **RBAC duplo:** UX (visibility) + server (`has_permission()`).
- **Transação atômica:** Postgres BEGIN/COMMIT na RPC; rollback em qualquer falha.
- **Imutabilidade do protocolo:** `trg_protect_atendimento_protocolo` + `block_friendly_id_update`.

## 5. Regra de ouro
> Nenhuma escrita em `atendimentos / atendimento_exames / atendimento_pagamentos` deve ocorrer fora de `create_atendimento_tx` / `update_atendimento_tx`. Frontend escreve **somente** via Edge Function.
