# SISLAC — Triggers Catalog

**Total:** 149 triggers · **Fonte:** `docs/security/_inventory-triggers.txt`

## Padrões (3 famílias)

| Família | Qtd. | Função base | Motivo |
|---|---:|---|---|
| `*_updated_at` / `touch_*` | ~75 | `set_updated_at_timestamp()`, `touch_app_settings_updated_at()`, `tg_<tab>_updated_at()` | Mantém `updated_at` automaticamente |
| `audit_*` / `audit_trigger` | ~50 | `audit_trigger()` (genérica) + audits específicas | Trilha de auditoria por mutação |
| Regras de domínio | ~24 | `recompute_status_*`, `*_rbac_check`, `*_snapshot_*`, `*_assign_protocolo`, `*_sign_protocolo`, `fwd_*`, `require_justificativa_pos_finalizacao`, `protect_*`, `block_*`, `ensure_*`, `snapshot_exame_terceirizado` | Garantem invariantes do negócio |

## Classificação

### ✅ Necessária (~120)
Todas as `audit_trigger`, `recompute_status_*`, `*_assign_protocolo`, `*_sign_protocolo`, `*_rbac_check`, `*_snapshot_*`, `require_justificativa_pos_finalizacao`, `protect_atendimento_protocolo`, `fwd_*_to_*` (split de auditoria), `ensure_recoleta_motivo_nome`, `ensure_default_user_role`, `block_friendly_id_update`, `snapshot_exame_terceirizado`.

### 🟡 Consolidável (~24)
- **Duplicação em `atendimento_exames`:** `audit_atendimento_exames` + `audit_trigger` + `trg_audit_atendimento_exames` rodam no mesmo evento → manter **uma** (preferir `audit_trigger` genérica). Mesmo padrão em `atendimento_pagamentos` e `atendimentos`.
- **Duplicação em `app_settings`:** `audit_app_settings` + `audit_app_settings_trigger` no mesmo INSERT/UPDATE/DELETE → manter uma.
- **75 funções `touch_*_updated_at` / `tg_*_updated_at`** → consolidar em `set_updated_at_timestamp()` única (já existe e é usada em `comprovante_links`).

### ❌ Obsoleta (0 identificadas)
Nenhum trigger sem dono ou sem efeito útil foi encontrado.

## Tabela com mais triggers
| Tabela | # triggers | Comentário |
|---|---:|---|
| `atendimento_exames` | 7 | 3 redundantes (auditoria duplicada + `touch_*` apontando para função "errada" `touch_app_settings_updated_at` que apenas seta `updated_at`) |
| `atendimentos` | 6 | 2 auditorias redundantes |
| `atendimento_pagamentos` | 4 | 2 auditorias redundantes |

## Função-monstro
`touch_app_settings_updated_at()` é reusada como "set updated_at genérico" em várias tabelas (atendimento_exames, atendimento_pagamentos). Nome induz a erro — **renomear para `set_updated_at()`** sem mudar comportamento (P2).
