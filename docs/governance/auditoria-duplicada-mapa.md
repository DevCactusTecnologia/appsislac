# Auditorias Duplicadas — Mapa & Plano (P1)

> Data: 2026-06-15 · Fase 2 do P1 Hardening · **Somente documentação** — nenhuma migration emitida.

## 1. Escopo
Tabelas com mais de uma trigger AFTER INSERT/UPDATE/DELETE escrevendo trilha de auditoria.

## 2. Mapa observado (fonte: `docs/security/_inventory-triggers.txt`)

| Tabela | Trigger | Função | Destino | Status |
|---|---|---|---|---|
| `atendimentos` | `audit_atendimentos` | `audit_trigger()` | `audit_logs` (genérico) | 🟢 obrigatório |
| `atendimentos` | `trg_audit_atendimentos` | `audit_atendimentos()` | `atendimento_audit` (específico) | 🟡 redundância potencial |
| `atendimento_exames` | `audit_atendimento_exames` | `audit_trigger()` | `audit_logs` | 🟢 obrigatório |
| `atendimento_exames` | `trg_audit_atendimento_exames` | `audit_atendimento_exames()` | `atendimento_audit` | 🟡 redundância potencial |
| `atendimento_pagamentos` | `audit_atendimento_pagamentos` | `audit_trigger()` | `audit_logs` | 🟢 obrigatório |
| `atendimento_pagamentos` | `trg_audit_atendimento_pagamentos` | `audit_atendimento_pagamentos()` | `atendimento_audit` | 🟡 redundância potencial |
| `app_settings` | `audit_app_settings` | `audit_trigger()` | `audit_logs` | 🟢 obrigatório |
| `app_settings` | `audit_app_settings_trigger` | `audit_app_settings()` | `app_settings_audit` | 🟡 redundância potencial |

`audit_logs` também recebe forwarders (`fwd_audit_logs_split`, `fwd_atendimento_audit_to_operational`, `fwd_app_settings_audit_to_platform`) que **distribuem** a trilha genérica para tabelas especializadas — portanto a duplicação não é simétrica.

## 3. Análise de equivalência

Para qualificar uma remoção, o evento precisa registrar:
**(a) mesma informação · (b) mesmo timestamp · (c) mesmo ator · (d) mesmo evento.**

| Par avaliado | (a) campos | (b) ts | (c) actor | (d) op | Equivalente? |
|---|---|---|---|---|---|
| `audit_trigger` vs `audit_atendimentos` | Genérico armazena `before/after` JSONB; específico grava colunas tipadas + `motivo`/`justificativa` | igual | igual (`auth.uid()`) | igual | **❌ Não — específico carrega `justificativa` e snapshot de campos clínicos** |
| `audit_trigger` vs `audit_atendimento_exames` | Específico guarda `exame_nome`, `status`, `valor` snap | igual | igual | igual | **❌ Não — colunas específicas usadas por relatórios** |
| `audit_trigger` vs `audit_atendimento_pagamentos` | Específico guarda `tipo`, `valor`, `data` snap | igual | igual | igual | **❌ Não — específico alimenta dossiê financeiro** |
| `audit_trigger` vs `audit_app_settings` | Específico mantém `chave_alterada` legada usada por `fwd_app_settings_audit_to_platform` | igual | igual | igual | **❌ Não — forwarder depende do schema específico** |

## 4. Conclusão

> Não há equivalência comprovada em nenhum dos 4 pares.
> **Nenhuma trigger é removida nesta fase.**

A duplicidade aparente é **essencial**, não acidental:
- `audit_trigger` alimenta `audit_logs` (canal genérico, RBAC/compliance).
- `audit_<tab>` alimenta `<tab>_audit` com colunas tipadas usadas por relatórios/dossiês e forwarders cross-DB (`fwd_*_to_platform/operational`).

## 5. O que é
- **Obrigatório:** todas as 8 triggers acima.
- **Redundante:** ø (nenhuma comprovada).
- **Legado puro:** ø (todas têm consumidor ativo).

## 6. Recomendação (não executada — fora do escopo P1)
1. **P2** — adicionar coluna `audit_logs.forwarded_to text[]` para tornar explícito quando o registro já foi espelhado, evitando dupla leitura.
2. **P2** — renomear `touch_app_settings_updated_at()` → `set_updated_at()` (usado em ~75 triggers fora da auditoria; tema já mapeado em `docs/governance/triggers-catalog.md`).
3. **P3** — substituir `audit_<tab>` específicas por VIEWs sobre `audit_logs` com `jsonb_to_record`, eliminando triggers físicas. Requer regressão de relatórios.

## 7. Veredito
**0 triggers de auditoria removidas. 0 consolidadas. 8 mantidas (todas obrigatórias).** Sistema permanece auditável e em conformidade. Olhou. Entendeu. Manteve.
