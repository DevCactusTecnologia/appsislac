# SISLAC — Triggers Audit (Phase 7)

**Data:** 2026-06-15. Somente leitura. Base: `_inventory-triggers.txt` (149 triggers).

---

## 1. Famílias

| Família | Quantidade | Necessária? | Redundante? | Substituível? |
|---|---:|---|---|---|
| `*_updated_at` / `touch_*` | ~75 | ✅ sim | 🟡 padrão repetido — 1 função `touch_updated_at()` genérica resolveria | sim, P2 |
| `audit_*` / `audit_trigger` | ~50 | ✅ sim (SSOT auditoria) | 🟢 não | manter |
| `fwd_*_to_*` (forward audit) | ~10 | ✅ sim (split plataforma/operacional) | 🟢 não | manter |
| `recompute_status_*` | 3-4 | ✅ sim (atendimento status) | 🟢 não — única fonte de verdade | manter |
| `*_rbac_check_*` | 2 | ✅ sim (defesa em profundidade) | 🟢 não | manter — complementa policy |
| `*_snapshot_*` | 2 | ✅ sim (congela regulatório) | 🟢 não | manter |
| `*_assign_protocolo` | 1 | ✅ sim | 🟢 não | manter |
| `set_tenant_id_default` | aplicável | ✅ sim | 🟢 não | manter |

---

## 2. Riscos detectados

### 2.1 Sobreposição de `audit_trigger` em `app_settings`
Encontrado em `_inventory-triggers.txt`:
```
audit_app_settings           AFTER INS/UPD/DEL → audit_trigger()
audit_app_settings_trigger   AFTER INS/UPD/DEL → audit_app_settings()
```
**Dois triggers** rodam por linha alterada de `app_settings`. Provável duplicação herdada de migração. Validar se `audit_app_settings()` ainda é necessária ou se `audit_trigger()` (genérica) já cobre. **P2.**

### 2.2 Múltiplos `*_updated_at` snowflake
Mesma lógica copy-paste em ~70 tabelas. Não é risco de segurança — é manutenção. **P2.**

### 2.3 Triggers que NÃO existem (e talvez devessem)
Nenhum gap crítico detectado nesta rodada. `set_tenant_id_default` está aplicada em todas as tabelas que têm `tenant_id NOT NULL` (confirmação amostral).

---

## 3. Veredito

- Funcionalmente: 🟢 todos necessários.
- Estilo/manutenção: 🟡 padrão repetido em `*_updated_at` e duplicação em `audit_app_settings*`.
- Segurança: 🟢 nenhum trigger expõe risco.

**Fim Fase 7.** Nada alterado.
