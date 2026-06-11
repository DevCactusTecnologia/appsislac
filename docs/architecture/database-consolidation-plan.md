# Database Consolidation Plan

> **Não executar.** Plano de consolidação inspirado no schema enxuto do Coremas (52 tabelas).
> Lovable tem ~95 tabelas — meta: reduzir ~15 sem perda funcional.

---

## 1. Classificação por natureza

### 1.1 Entidades de domínio (manter — uma por conceito)
`pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `exames_catalogo`, `exame_parametros`, `valores_referencia`, `convenios`, `convenio_faturas`, `convenio_fatura_itens`, `orcamentos`, `orcamento_exames`, `recoletas`, `amostras`, `especialistas`, `unidades`, `tenants`, `tenant_registry`, `profiles`, `user_roles`, `mapas_trabalho`, `mapa_exames`, `documento_templates`, `setores_laboratoriais`, `tabela_preco_itens`, `solicitacoes_publicas`, `comprovante_links`.

### 1.2 Técnicas/Infraestrutura (manter)
`integrations`, `integration_*` (10 tabelas — domínio próprio), `cron_health`, `app_settings`, `saas_settings`, `tenant_lab_config`, `tenant_settings_public`, `tenant_pages`, `tenant_payment_gateways`, `tenant_whatsapp_config`, `tenant_subscriptions*`, `subscription_plans`, `inscricoes`, `signup_*`, `public_rate_limits`, `tenant_blocklist`, `friendly_id_counters`, `protocolo_sequence`, `amostra_sequence`.

### 1.3 Auditoria (consolidar — ver `audit-consolidation-plan.md`)
10 tabelas → 2.

### 1.4 Dicionários (consolidar)
Ver §3.

### 1.5 Estoque (avaliar)
`estoque_fornecedores`, `estoque_insumos`, `estoque_lotes`, `estoque_movimentacoes` — manter (domínio próprio, OK).

---

## 2. Tabelas duplicadas/sobrepostas identificadas

| Grupo | Tabelas | Proposta |
|---|---|---|
| Auditoria | 10 tabelas (ver doc dedicado) | 2 tabelas + views |
| Dicionários financeiros | `financeiro_formas_pagamento`, `financeiro_tipos_despesa`, `financeiro_destinos_pagamento` | Migrar p/ `select_options` |
| Dicionários operacionais | `motivos_cancelamento`, `recoletas_motivos` | Migrar p/ `select_options` |
| Logs integração | `integration_logs`, `integration_requests`, `integration_responses` | Avaliar fusão em `integration_events` |
| Resultados | `resultados_entregas`, `orientacoes_entregues` | Manter (semântica distinta) |

---

## 3. Consolidação `select_options`

### Hoje
```
select_options (categoria, valor, label, tenant_id, ...)
motivos_cancelamento (descricao, ativo, tenant_id)
recoletas_motivos (descricao, ativo, tenant_id)
financeiro_formas_pagamento (nome, ativo, tenant_id)
financeiro_tipos_despesa (nome, ativo, tenant_id)
financeiro_destinos_pagamento (nome, ativo, tenant_id)
```

### Proposta
```sql
-- select_options já existe com categoria
-- Migrar registros:
INSERT INTO select_options (categoria, valor, label, tenant_id, ativo, ordem, ...)
SELECT 'motivo_cancelamento', id::text, descricao, tenant_id, ativo, ordem, ...
FROM motivos_cancelamento;
-- repetir para os outros 4
```

### Estratégia
1. **Fase A:** criar views `motivos_cancelamento_v` etc apontando para `select_options`.
2. **Fase B:** migrar 1 store por sprint (`motivosCancelamentoStore`, `recoletasMotivosStore`, `financeiroListasStore` → consumirem `selectOptionsStore`).
3. **Fase C:** após zero leitores, dropar tabelas originais.

### Risco
- Baixo se views forem compatíveis.
- Atenção a FKs: `atendimentos.motivo_cancelamento_id` → migrar para string `motivo_cancelamento_codigo` OU manter FK e popular `select_options.id`.

### Não tocar
- `select_options.tenant_id NULL` (dicionário global) — semântica preservada.

---

## 4. Logs de integração

Hoje 3 tabelas (`integration_logs`, `integration_requests`, `integration_responses`) — relação 1:1:1 frequente.

**Proposta:** view `integration_events` materializada para leitura; consolidar inserts em transação. Manter tabelas físicas (rollback caro).

---

## 5. Métricas

| Tabela origem | Linhas (est.) | Destino | Risco |
|---|---|---|---|
| `motivos_cancelamento` | <100 | `select_options` | Baixo |
| `recoletas_motivos` | <50 | `select_options` | Baixo |
| `financeiro_formas_pagamento` | <30 | `select_options` | Baixo |
| `financeiro_tipos_despesa` | <100 | `select_options` | Baixo |
| `financeiro_destinos_pagamento` | <30 | `select_options` | Baixo |
| 8 tabelas audit | grandes | 2 tabelas | Médio |

**Meta:** ~95 → ~80 tabelas (-15%).

---

## 6. Não fazer

- ❌ Fundir `atendimento_exames` em `atendimentos` (1:N é correto).
- ❌ Fundir `valores_referencia` em `exame_parametros` (banda etária/sexo precisa N:1).
- ❌ Remover `tenant_registry` (SSOT obrigatório).
- ❌ Remover qualquer tabela com `_audit` antes de consolidação completa + retenção legal cumprida.
