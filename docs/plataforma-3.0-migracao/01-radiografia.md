# Plataforma 3.0 — Migração Shared → Dedicated

## Fase 3 · Etapa 1 — OLHAR (Radiografia)

Data: 2026-07-01
Tenant alvo: `00000000-0000-0000-0000-000000000001` (lab 0001)
Destino: projeto Supabase dedicado já provisionado (vazio, com as 4 tabelas do allowlist Fase 2)

Regra OECV: este documento é apenas **olhar**. Nenhuma ação executada. Próxima etapa (Entender) requer aprovação explícita.

---

## 1. Superfície do schema `public` (shared)

| Categoria | Qtd | Observação |
|---|---:|---|
| Tabelas | 131 | Inclui 13 views que aparecem em `information_schema.tables` |
| Views (comuns) | 13 | Precisam ser recriadas no destino |
| Materialized views | 0 | Nada a migrar |
| Enums | 14 | Precisam ser criados **antes** das tabelas |
| Funções PL/pgSQL | 196 | Inclui `current_tenant_id`, `has_role`, `is_super_admin`, triggers, RPCs |
| Triggers (não-internos) | 195 | `updated_at`, auditoria, sequences, validações |
| Foreign keys | 144 | Define ordem obrigatória de carga |
| Índices | 478 | Inclui PKs, uniques, gin/gist |
| Extensões | 7 | `pg_cron`, `pg_net`, `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `supabase_vault`, `uuid-ossp` |

**Impacto:** o `super-admin-provision-tenant-schema` atual só cria 4 tabelas. Para Fase 3 precisamos de um provisionador **schema-completo** que também replique enums, funções, triggers, views e extensões.

---

## 2. Volume de dados do tenant 0001

### 2.1 Tabelas com dados relevantes (top por volume)

| Tabela | Linhas | Categoria |
|---|---:|---|
| `operational_audit` | 13.487 | Auditoria (pode ser truncada?) |
| `audit_logs` | 13.472 | Auditoria (idem) |
| `pacientes` | 2.297 | **CORE** |
| `valores_referencia` | 495 | Dicionário clínico |
| `exame_layouts` | 441 | Configuração |
| `exames_catalogo` | 441 | **CORE** |
| `tabela_preco_itens` | 441 | **CORE** |
| `especialistas` | 266 | Cadastro |
| `exame_parametros` | 239 | Configuração |
| `atendimento_exames` | 96 | **CORE** |
| `amostras` | 69 | **CORE** |
| `select_options` | 60 | Dicionários |
| `ai_audit` | 44 | Auditoria IA |
| `recoletas_motivos` | 23 | Dicionário |
| `financeiro_audit` | 23 | Auditoria financeira |
| `financeiro_tipos_despesa` | 15 | Dicionário |
| `setores_laboratoriais` | 13 | Cadastro |
| `protocolo_auditoria` | 12 | Auditoria |
| `atendimento_pagamentos` | 12 | **CORE** |
| `atendimentos` | 11 | **CORE** |
| `financeiro_entradas` | 10 (VIEW) | Derivado — **não migrar** |
| `posicoes_galeria` | 10 | Configuração UI |
| `materiais_amostra` | 8 | Dicionário |
| `motivos_cancelamento` | 8 | Dicionário |
| `reguas_etarias` | 7 | VR 2.0 |
| `financeiro_destinos_pagamento` | 7 | Dicionário |
| `financeiro_formas_pagamento` | 7 | Dicionário |
| `documento_templates` | 6 | Templates |
| `amostra_sequence` | 6 | Sequence data |
| `guia_sequence` | 6 | Sequence data |
| `mapas_trabalho` | 5 | **CORE** |
| `caixa_sessoes` | 3 | Financeiro |
| `storage_audit` | 3 | Auditoria |
| `friendly_id_counters` | 3 | Sequence data |
| `profiles` | 2 | **CORE** (2 usuários) |
| `app_settings` | 2 | Config |
| `locais_armazenamento` | 2 | Cadastro |
| `tenant_payment_gateways` | 2 | Config PIX |
| `estornos financeiro_estornos` | 2 | Financeiro |
| `convenios`, `labs_apoio`, `mapa_exames`, `orcamentos`, `galerias`, `unidades`, `tenant_lab_config`, `tenant_registry`, `tenant_subscriptions_billing`, `atendimento_audit`, `subscription_changes_log` | 1 cada | Config/CORE |

### 2.2 Tabelas vazias (73 tabelas)
Migrar apenas estrutura; sem linhas para o tenant 0001. Confere: financeiro (saidas, faturas, glosas, competencias), integrações (dbsync/hermes), whatsapp, estoque, expurgo, transporte, recoletas, orçamento exames, criticos, integrations completa.

### 2.3 Views (não migrar dados, só recriar definição)
`financeiro_entradas`, `vw_coleta_diaria`, `vw_coletas_operacionais`, `vw_liberacao_diaria`, `vw_producao_diaria`, `vw_producao_operacional`, `convenio_competencia_resumo`, `convenio_fatura_resumo`, `exames_publicos_view`, `platform_health_aggregate`, `provider_health_current`, `tenant_public`, `unidades_publicas`.

### 2.4 Tabelas **globais** que NÃO devem ir para o dedicado
Ficam apenas no shared (control plane / dados de plataforma):

- `tenants`, `tenant_registry`, `tenant_blocklist`, `tenant_public`, `tenant_subscriptions`
- `subscription_plans`, `subscription_changes_log`, `saas_settings`
- `platform_audit`, `signup_attempts`, `inscricoes`, `public_rate_limits`
- `cities`, `states` (dicionário geográfico compartilhado — decidir se replica ou consulta remota)
- `cron_health`, `whatsapp_templates_cache` (globais)
- `protocolo_sequence` (2 linhas globais — reavaliar)

### 2.5 `user_roles`
Tabela **sem `tenant_id`** (usa `has_role(user_id, role)` global). 5 linhas totais no shared. Para o dedicado, filtrar pelas linhas cujos `user_id` estejam nos 2 profiles do tenant 0001.

---

## 3. Autenticação (`auth`)

- **2 usuários** no `profiles` do tenant 0001 → 2 registros a migrar em `auth.users` do projeto dedicado.
- Supabase Auth **não federa**: precisamos usar Admin API do dedicado para recriar cada usuário **preservando o `id`** (senão quebram FKs `created_by`, `analista_id`, etc.).
- Método: `GET /auth/v1/admin/users/{id}` no shared (via service role) → `POST /auth/v1/admin/users` no dedicado com `id`, `email`, `email_confirm=true`, `password_hash` copiado do shared (mantém senha atual).
- `user_roles` das 5 linhas — replicar as que pertencem aos 2 users.

**Bloqueador conhecido:** service role e senha do Postgres do shared não são acessíveis via Lovable Cloud. Solução: rodar a migração de auth por edge function autenticada como super_admin, usando `SUPABASE_SERVICE_ROLE_KEY` já disponível no runtime das edges.

---

## 4. Storage

Buckets existentes (8):
`assinaturas`, `comprovantes`, `integration-assets`, `integration-pdfs`, `provider-catalog-imports`, `resultados-externos`, `tenant-assets` (público), `tenant-site` (público).

Objetos vinculados ao tenant 0001: **1 objeto** em `assinaturas` (35 kB). Volume trivial.

Ação: criar os 8 buckets no dedicado (com mesma visibilidade) + copiar 1 arquivo. Storage não é migrável via SQL — usar Storage API (download → upload).

---

## 5. Extensões

Precisamos habilitar no dedicado **antes** de qualquer coisa:
- `pgcrypto`, `uuid-ossp` — obrigatórias (gen_random_uuid usado em quase toda PK)
- `pg_trgm` — usado em buscas (`similarity` em pacientes/exames)
- `pg_net` — usado por edge triggers (fila WhatsApp, etc.)
- `pg_cron` — usado por jobs agendados (revisar se serão replicados)
- `supabase_vault` — se houver secrets em vault (verificar na Fase 2 Entender)
- `pg_stat_statements` — observabilidade, opcional

---

## 6. Bloqueadores e riscos identificados

| # | Risco | Severidade | Onde tratar |
|---|---|---|---|
| R1 | Provisionador atual só cria 4 tabelas | Alta | Etapa CONFIGURAR |
| R2 | 196 funções PL/pgSQL, muitas com `SECURITY DEFINER` e `search_path`; algumas referenciam `auth.uid()` | Alta | Etapa ENTENDER |
| R3 | Modelo dedicado é "sem tenant_id"; migração precisa DROPAR a coluna em cada INSERT | Alta | Etapa CONFIGURAR |
| R4 | `pg_cron` jobs no shared podem duplicar execução se replicados | Média | Decidir na Etapa ENTENDER |
| R5 | `auth.users` no dedicado tem IDs próprios; se não preservarmos `id`, quebram todas as FKs `user_id`/`created_by` | Alta | Usar Admin API com `id` explícito |
| R6 | Auditoria (`audit_logs` 13k + `operational_audit` 13k) infla a migração para pouco valor | Baixa | Perguntar se trunca ou migra |
| R7 | Views dependem de funções e outras views (ordem topológica) | Média | Gerar ordem via `pg_depend` |
| R8 | RLS: no dedicado desligamos RLS (isolamento = projeto). Precisamos garantir GRANT `anon`/`authenticated` explícito | Alta | Já parcialmente resolvido na Fase 2 |
| R9 | Sequences (`amostra_sequence`, `guia_sequence`, `friendly_id_counters`) precisam ir com valores atuais para não colidir com IDs futuros | Média | Migrar como dados |
| R10 | `tenant_registry` continua no shared — o dedicado NÃO tem essa tabela (control plane) | Baixa | Não migrar |

---

## 7. Estimativa de esforço (indicativa)

| Componente | Estimativa |
|---|---|
| Provisionador schema-completo (edge) | 1 dia |
| Migrador de auth (edge) | 0.5 dia |
| Migrador de dados (edge com plano de execução) | 1 dia |
| Migrador de storage (edge) | 0.5 dia |
| UI Super Admin — wizard de migração com 4 passos + logs | 1 dia |
| Testes end-to-end + cutover no lab 0001 | 1 dia |

Total estimado: **~5 dias de trabalho**, ~20k linhas de dados úteis + 1 arquivo + 2 usuários. Volume real é pequeno; a complexidade está em **replicar o schema com fidelidade**.

---

## 8. Perguntas em aberto (decidir na Etapa ENTENDER)

1. **Auditoria**: migrar `audit_logs`/`operational_audit`/`ai_audit`/`financeiro_audit` (~27k linhas) ou zerar no destino?
2. **`pg_cron`**: replicar jobs no dedicado ou manter só no shared?
3. **Dicionários geográficos** (`cities` 5570, `states` 27): copiar snapshot no dedicado ou deixar consulta cross-project?
4. **Extensão `supabase_vault`**: há secrets armazenados que precisam migrar?
5. **Cutover**: janela de manutenção com shared read-only, ou migração online com delta?
6. **Rollback**: manter shared populado por N dias como fallback?

---

## Regra de parada — PARAR AQUI

Etapa 1 (OLHAR) concluída. Aguardo aprovação explícita para iniciar Etapa 2 (**ENTENDER**), que vai:
- Mapear dependências entre funções/triggers/views (grafo topológico)
- Detectar funções incompatíveis com o modelo dedicado (uso de `current_tenant_id`, `tenant_id`)
- Definir estratégia final para os 6 pontos em aberto acima
- Produzir o plano de execução (ordem exata, transações, checkpoints)
