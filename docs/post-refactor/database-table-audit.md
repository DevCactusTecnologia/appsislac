# Auditoria de Tabelas — Pós-Refatorações

> Análise puramente diagnóstica. Nenhuma alteração de schema foi feita.
> Data do snapshot: 2026-06-12. Fonte: `information_schema` + `pg_stat_user_tables` + `pg_policies` no banco em produção (preview).

---

## 1. Resumo executivo

| Métrica | Plano original (baseline) | Hoje | Δ |
|---|---|---|---|
| Tabelas em `public` | ~95 | **98** | **+3** |
| Views em `public` | n/d | 6 | — |
| Total de objetos relacionais em `public` | ~95 | **104** | +9 |
| Foreign keys | n/d | 116 | — |
| Políticas RLS | n/d | 306 | — |
| Funções em `public` | n/d | 149 | — |

**Conclusão direta:** o número de tabelas **não diminuiu**. O plano `docs/architecture/database-consolidation-plan.md` (meta: 95 → ~80, −15%) **ainda não foi executado** — segue como plano. As refatorações recentes foram concentradas em **frontend, SSOT de stores, edge functions e hardening RLS**, não em consolidação física de tabelas.

O ganho real do período foi **organizacional e de integridade** (RLS, GRANTs, SSOT, auditoria), não redução de cardinalidade do schema.

---

## 2. Por que o número subiu (+3 vs baseline)

Foram adicionadas estruturas novas que **respondem a requisitos reais** (não complexidade acidental):

| Objeto | Tipo | Razão |
|---|---|---|
| `operational_audit` | tabela | Destino da consolidação de auditoria (já existe vazio, escrevendo paralelo) |
| `platform_audit` | tabela | Auditoria do Super Admin (escopo plataforma) |
| `provider_health_metrics` / `provider_circuit_state` / `provider_health_current` (view) | tabela/view | Observabilidade de integrações (DBSync/Hermes) |
| `tenant_public` / `unidades_publicas` / `exames_publicos_view` | views | Camada pública sem expor RLS interno (landing, portal) |
| `financeiro_entradas` | **view** | SSOT — "Entradas" derivam de `atendimento_pagamentos`. Confirma a regra `mem://features/financeiro/integridade-de-entradas` (read-only) |
| `platform_health_aggregate` | view | Dashboard super admin |

Ou seja: as **novas tabelas físicas** são auditoria consolidada e telemetria de integrações; o resto são **views derivadas** (custo de schema zero, ganho de SSOT alto).

---

## 3. Tabelas candidatas a remoção (não usadas / duplicadas)

Cruzamento de `pg_stat_user_tables` × `rg` no código (`src/` + `supabase/functions/`):

### 3.1 Candidatas claras a deprecar (uso ≤1 referência e/ou substituídas)

| Tabela | Refs no código | Status real | Recomendação |
|---|---|---|---|
| `tuss_catalogo` | 1 | Vazia, nunca lida | Avaliar drop após confirmar que TUSS vem de `exames_catalogo.codigo_tuss` |
| `tenant_migration_log` | 1 | Vazia, planejamento híbrido pg/supabase ainda não ativo | Manter até híbrido ativar (rastreabilidade) |
| `signup_rate_limit` | 1 | Substituída por `public_rate_limits` (genérico) | Drop seguro |
| `signup_attempts` | 1 | Ainda em uso pelo fluxo de inscrição | Manter |
| `protocolo_auditoria` | 1 | Substituída por `operational_audit` (consolidação em curso) | Drop após backfill (Sprint 4 do plano) |

### 3.2 Dicionários financeiros / operacionais (alvos do plano de consolidação)

Plano oficial: migrar para `select_options` (1 tabela genérica) — **ainda pendente**.

| Tabela | Linhas | Refs | Substituível por |
|---|---|---|---|
| `financeiro_destinos_pagamento` | 7 | 3 | `select_options` (categoria `destino_pagamento`) |
| `financeiro_formas_pagamento` | 7 | 4 | `select_options` (categoria `forma_pagamento`) |
| `financeiro_tipos_despesa` | 15 | 3 | `select_options` (categoria `tipo_despesa`) |
| `motivos_cancelamento` | 8 | 6 | `select_options` (categoria `motivo_cancelamento`) |
| `recoletas_motivos` | 23 | 4 | `select_options` (categoria `motivo_recoleta`) |

**Ganho potencial:** −5 tabelas, sem perda funcional. Risco: baixo (são CRUDs de dicionário); requer 1 migration + atualização de 5 stores.

### 3.3 Auditoria (alvo do plano dedicado)

Consolidação 10 → 2 ainda não fechada. Tabelas legadas continuam ativas escrevendo em paralelo:

`audit_logs`, `atendimento_audit`, `storage_audit`, `pdf_override_audit`, `app_settings_audit`, `subscription_changes_log`, `tenant_provision_audit`, `protocolo_auditoria`, `criticos_comunicacoes`, `tenant_migration_log`

**Ganho potencial:** −8 tabelas após Sprint 4 do plano (retenção legal cumprida).

### 3.4 Logs de integração (avaliação)

`integration_logs`, `integration_requests`, `integration_responses` (relação 1:1:1 frequente).
Plano sugere view `integration_events` materializada. **Ganho potencial:** −2 tabelas via fusão.

---

## 4. Tabelas com complexidade/relacionamento ainda elevado

Hotspots de relacionamento (≥ 5 FKs entrando ou saindo), por inspeção de `pg_constraint`:

| Tabela | Papel | Avaliação |
|---|---|---|
| `atendimentos` | Hub operacional | **Aceitável** — 1:N legítimo com `atendimento_exames`, `atendimento_pagamentos`, `recoletas`, `mapa_exames`. Não fundir. |
| `atendimento_exames` | Linha do exame | **Aceitável** — 45 colunas é alto, mas reflete domínio clínico (status, valores, terceirização, resultado). Já documentado como SSOT. |
| `exames_catalogo` | Catálogo mestre | **Largo (69 colunas)** mas é catálogo único — fusão com `exame_parametros` seria erro (1:N necessário). |
| `tenant_registry` / `tenants` / `tenant_settings_public` | Tenant | **Duplicação parcial** — `tenants` (legado) e `tenant_registry` (SSOT) coexistem. Já há view `tenant_public`. Recomendação: confirmar `tenants` como deprecated e migrar leitores residuais. |
| `integration_provider_exams` / `_exam_map` / `_exam_params` / `_exam_refs` | Integração | **Justificado** — cada um tem semântica distinta (catálogo do provider, mapeamento, parâmetros, referências). |

---

## 5. Pontos saudáveis (não tocar)

- `select_options` com `tenant_id NULL` como dicionário global — semântica **intencional** (`mem://architecture/global-dictionaries`).
- Separação `valores_referencia` × `exame_parametros` — N:1 necessário por banda etária/sexo.
- Separação `user_roles` × `profiles` — exigência de segurança (anti privilege escalation).
- `friendly_id_counters`, `protocolo_sequence`, `amostra_sequence` — geradores serializáveis.
- Views públicas (`*_publicas`, `tenant_public`) — isolamento de RLS pública vs interna.

---

## 6. Resposta direta às três perguntas

### 6.1 O número de tabelas diminuiu?
**Não.** Foi de ~95 → 98 (+3). As reduções planejadas (`-15 tabelas`) ainda não foram executadas — continuam como plano em `docs/architecture/database-consolidation-plan.md` e `audit-consolidation-plan.md`.

### 6.2 Existe alguma tabela que não será mais usada?
**Sim, 3 grupos:**
- **Imediato (drop seguro):** `signup_rate_limit`, possivelmente `tuss_catalogo` (validar leitor).
- **Após executar plano de dicionários (−5):** `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`, `motivos_cancelamento`, `recoletas_motivos`.
- **Após plano de auditoria (−8, prazo legal):** `atendimento_audit`, `storage_audit`, `pdf_override_audit`, `app_settings_audit`, `subscription_changes_log`, `tenant_provision_audit`, `protocolo_auditoria`, `tenant_migration_log` (+ avaliar fusão dos 3 `integration_*`).

**Potencial total de redução: ~15 tabelas → 83 (−15%).** Coincide com a meta do plano original.

### 6.3 Complexidade e relacionamento estão mais aceitáveis?
**Parcialmente sim.** O que melhorou de fato:
- ✅ **RLS coberta**: 306 políticas, todas as tabelas de domínio têm `current_tenant_id()` + `is_super_admin()`.
- ✅ **SSOT lógico**: `financeiro_entradas` virou **view** sobre `atendimento_pagamentos` — eliminou divergência de dados sem mexer no schema físico.
- ✅ **Views públicas** isolam superfície externa, evitando vazamento via RLS.
- ✅ **Auditoria nova** (`operational_audit`, `platform_audit`) já existe e está pronta para receber backfill.
- ✅ **Relacionamentos não cresceram artificialmente** — 116 FKs para 98 tabelas (≈1.18 FK/tabela) é saudável.

O que **continua pendente** (complexidade física, não lógica):
- ⚠️ Dicionários ainda em 5 tabelas separadas em vez de `select_options`.
- ⚠️ 10 tabelas de auditoria coexistem com as 2 consolidadas.
- ⚠️ `tenants` (legado) vs `tenant_registry` (SSOT) precisam de finalização.

---

## 7. Veredito

> **O schema ficou mais correto, mais seguro e com SSOT lógico — mas não ficou menor.**
> A redução física planejada (−15 tabelas) é executável com baixo risco, mas ainda não foi feita e **não está sendo proposta aqui** (regra de parada).

Próxima janela natural para execução (se/quando o usuário autorizar): Sprint dedicado de "Consolidação de dicionários" (1ª etapa, risco baixo, ganho −5 tabelas imediato).
