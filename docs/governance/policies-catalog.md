# SISLAC — Policies Catalog

**Total:** 305 policies em 97 tabelas (média 3,1/tab).
**Fonte:** `docs/security/_inventory-policies.txt`.

## Padrão dominante (78% das policies)
```sql
<tab>_select : is_super_admin(uid) OR (tenant_id = current_tenant_id() AND has_permission(uid,'…'))
<tab>_insert : tenant_id = current_tenant_id() AND has_permission(uid,'…')
<tab>_update : idem (USING == WITH CHECK)
<tab>_delete : tenant_id = current_tenant_id() AND has_role(uid,'admin')
```
**Tenant resolution:** sempre via `current_tenant_id()` (SECURITY DEFINER). Frontend nunca envia `tenant_id`.

## Classificação

### 🟢 Simples (≈240 policies · 78%)
Padrão CRUD acima. Passam no teste "olhou, entendeu". Tabelas: `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `amostras`, `pacientes`, `exames_catalogo`, `exame_*`, `convenios`, `tabela_preco_itens`, `convenio_faturas`, `financeiro_*`, `estoque_*`, `especialistas`, `unidades`, `setores_laboratoriais`, `mapas_trabalho`, `recoletas`, `valores_referencia`, `labs_apoio`, `documento_templates`, `motivos_cancelamento`, `tenant_lab_config`, `tenant_settings_public`, `whatsapp_mensagens`, `tenant_whatsapp_config`, `integration_*` (subset), `orcamentos`, `orcamento_exames`.

### 🟡 Média (≈50 policies · 16%)
Multi-permission OR, ou role-based misto.
- `atendimentos_select` / `atendimento_exames_select` — 6 permissões alternativas (`visualizar_atendimentos`, `registrar_coleta`, `analisar_amostra`, `liberar_resultado`, `imprimir_laudo`, `consultar_resultados`). **Necessário** — refletem o ciclo do atendimento.
- `tenant_payment_gateways_*` — restrito a `admin`/`manager`, com WITH CHECK separado para escrita.
- `user_roles_insert/update` — bloqueia escalonamento de `super_admin` por não-super_admin (hardening 2026-06-15).
- `select_options_*` — 5 policies para suportar `tenant_id NULL` (dicionário global).

### 🔴 Complexa (≈15 policies · 6%)
- `audit_logs` tem **duas** policies de SELECT redundantes: `"Admins veem logs do seu tenant"` (legada, usa subquery em `profiles`) + `audit_logs_select` (padrão `has_permission`). **Candidata a remoção da legada.**
- `solicitacoes_publicas` — 5 policies para suportar fluxo: anon insert via edge function + tenant read + super-admin read. Necessário, mas precisa comentário.
- `comprovante_links` — duplicação de policies em PT-BR (`"Tenant pode atualizar links..."`) coexiste com nomes técnicos. **Padronizar nomes** (cosmético).
- `cities` / `states` — `cities_anon_read` e `cities_public_read` ambas `USING (true)` — **duplicadas**, remover uma.

## Tabelas com >4 policies (revisar)
| Tabela | # | Motivo | Veredito |
|---|---:|---|---|
| `profiles` | 5 | self-read + admin-read + tenant-read + super-admin + write | Necessário |
| `select_options` | 5 | Suporte a global (NULL) + tenant | Necessário |
| `solicitacoes_publicas` | 5 | Anon insert + tenant read/update + super-admin | Necessário |
| `tabela_preco_itens` | 5 | CRUD + read técnico | OK, mas review |
| `unidades` | 5 | CRUD + public read p/ portal | Necessário |
| `documento_templates` | 5 | CRUD + read técnico | OK |

## Duplicações reais (candidatas a remoção)
1. `audit_logs` — `"Admins veem logs do seu tenant"` (legada) vs `audit_logs_select` (atual).
2. `cities` — `cities_anon_read` vs `cities_public_read` (idênticas).
3. `comprovante_links` — nomes PT-BR vs técnicos (consolidar nomenclatura).

## Heranças possíveis (não aplicar agora)
- Helper `can_access_tenant_row(tenant_id)` `RETURNS bool` poderia substituir `is_super_admin(uid) OR tenant_id = current_tenant_id()` em ~150 policies. Trade-off: reduz boilerplate mas adiciona uma camada para auditar. **Recomendação:** introduzir como opção, manter padrão atual para tabelas novas.
