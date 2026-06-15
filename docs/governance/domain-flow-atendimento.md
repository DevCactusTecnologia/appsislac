# Domain Flow — Atendimento (Onboarding em 10 min)

> Diagrama de domínio para novos desenvolvedores. Companion de `pipeline-atendimento.md`.

## Entidades e relações

```text
┌──────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│  Paciente    │──1:N─│   Atendimento    │──1:N─│  AtendimentoExame    │
│  (pacientes) │      │  (atendimentos)  │      │ (atendimento_exames) │
└──────────────┘      └────────┬─────────┘      └──────────┬───────────┘
                               │                            │
                               │ 1:N                        │ resultado
                               ▼                            ▼
                  ┌────────────────────────┐     ┌────────────────────┐
                  │ AtendimentoPagamento   │     │  ValorDigitado /   │
                  │(atendimento_pagamentos)│     │  Parâmetro Clínico │
                  └────────────┬───────────┘     └─────────┬──────────┘
                               │                            │
                               │ trigger                    │ trigger
                               └─────────► status_pagamento ◄──── recompute
                                              │
                                              ▼
                                ┌─────────────────────────┐
                                │  Financeiro (view)      │
                                │  financeiro_entradas    │
                                └─────────────────────────┘

                               │                            │
                               ▼                            ▼
                  ┌────────────────────────┐    ┌─────────────────────┐
                  │   Auditoria genérica   │    │  Auditoria tipada   │
                  │     (audit_logs)       │    │ (atendimento_audit) │
                  └────────────┬───────────┘    └──────────┬──────────┘
                               │ fwd                       │ fwd
                               ▼                           ▼
                       Platform/Operational audit stores

┌──────────────────────┐      ┌──────────────────────┐
│  ResultadoLiberado   │──────│   Entrega / Canal    │
│ (status_atendimento) │      │ resultados_entregas, │
└──────────────────────┘      │ comprovante_links    │
           │                  └──────────┬───────────┘
           │                             │
           ▼                             ▼
   ┌────────────────┐         ┌──────────────────────┐
   │ Portal público │         │   WhatsApp / E-mail  │
   │  tenant_pages  │         │  whatsapp_mensagens  │
   └────────────────┘         └──────────────────────┘
```

## Ciclo de vida (status_atendimento)
```
Pedido Realizado → Amostra Coletada → Em Análise → Amostra Analisada
  → Resultado Salvo → (Em Retificação → Retificado) → Resultado Liberado
                                                ↘ Cancelado / Pedido cancelado
```

## Ciclo de vida (status_pagamento)
```
Pagamento pendente → Pagamento parcial → Pagamento efetuado
                                      ↘ Pagamento cancelado
```
Derivado **exclusivamente** pelo trigger `recompute_atendimento_status`.

## Caminho do dado (write path)
```
UI (NovoAtendimento / ResultadoDetalhe / PagamentoDialog)
     │
     ▼
Edge Function (create-atendimento | update-atendimento)
     │ Auth (JWT) + RBAC (has_permission)
     ▼
RPC transacional (create_atendimento_tx | update_atendimento_tx)
     │ BEGIN
     ▼
Tabelas (atendimentos, atendimento_exames, atendimento_pagamentos)
     │
     ▼
Triggers (recompute_status_*, audit_*, snapshot_*, require_just_*)
     │ COMMIT
     ▼
Realtime → atendimentoStore (cache UI)
```

## Caminho do dado (read path)
```
atendimentoStore (Realtime cache) ──► UI operacional
financeiro_entradas VIEW ──────────► Financeiro
a_receber_pacientes_page RPC ──────► A-Receber
audit_logs / atendimento_audit ────► Auditoria / Dossiê
```

## Quem é dono de quê

| Domínio | Owner | Arquivo de referência |
|---|---|---|
| Paciente | `pacienteStore` | `src/data/pacienteStore.ts` |
| Atendimento | `atendimentoStore` (slices) | `src/data/atendimentoStore/*` |
| Exame catálogo | `exameCatalogoStore` | `src/data/exameCatalogoStore.ts` |
| Preço | `tabelaPrecoStore` | `src/data/tabelaPrecoStore.ts` |
| Financeiro | `financeiroStore` (saídas) + view (entradas) | `src/data/financeiroStore.ts` |
| Auditoria | DB | `audit_logs` + `*_audit` |

## Como debugar em 3 passos
1. **Identificar protocolo** (UI mostra `friendly_id`).
2. `SELECT * FROM audit_logs WHERE record_id::text LIKE '%<id>%' ORDER BY created_at DESC;`
3. Cruzar com `atendimento_audit` para snapshot tipado e `atendimento_pagamentos` para evolução do saldo.
