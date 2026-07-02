# 05 — Integrity Analysis

## Números
| Tipo | Total (schema public) |
|---|---:|
| Constraints totais | 1.544 |
| PRIMARY KEY | 119 (1 por tabela) |
| FOREIGN KEY | 147 |
| CHECK | 1.240 |
| UNIQUE | 39 |
| NOT NULL (implícito em NULL/NOT NULL) | — |
| Índices totais | 480 |

## Primary Keys
Todas as 119 tabelas possuem PK. Padrão: `id uuid default gen_random_uuid()` no domínio; `id bigint` em algumas tabelas legadas (`valores_referencia`, `states`, `cities`, sequenciadores).

## Foreign Keys
147 FKs cobrem os relacionamentos naturais do domínio. Ausências deliberadas:
- **`tenant_id` sem FK** em 116 tabelas — permite multi-tenant sem cascatas destrutivas e `tenant_id IS NULL` para dicionários globais.
- `atendimento_audit`, `financeiro_audit`, `platform_audit`, `pdf_override_audit`, `storage_audit`: guardam IDs por valor (sem FK) para sobreviver a `DELETE` da entidade original.
- `integration_dead_jobs`: cópia dos IDs sem FK para não bloquear purga.

## Cascatas (ON DELETE)
- `CASCADE` em tabelas-filhas obrigatórias: `atendimento_exames.atendimento_id`, `orcamento_exames.orcamento_id`, `amostra_alocacoes.amostra_id`, `expurgo_itens.expurgo_lote_id`, `convenio_fatura_itens.fatura_id`, `mapa_exames.mapa_id`.
- `RESTRICT`/`NO ACTION` em referências a catálogos: `atendimento_exames.exame_id`, `valores_referencia.exame_id`.
- `SET NULL` em relações opcionais: `atendimentos.especialista_id`, `atendimentos.convenio_id`.

## CHECK constraints — 1.240
Volume muito alto porque cada tabela é encapsulada pelo padrão Supabase de RLS + validação de tenant. Contam também os CHECKs de coluna gerada por Supabase Auth/Storage (schemas internos). No schema `public`, os CHECKs cobrem:
- `atendimentos.status IN (...)` e transições.
- `atendimento_exames.status_pagamento`, `status_coleta`, `status_analise`, `status_laudo`.
- `amostras.status`, `amostra_emprestimos.status`.
- `financeiro_saidas.valor > 0`.
- `caixa_sessoes.saldo_*` coerência.
- `tenant_registry.runtime_mode IN ('shared_db','isolated_db')`, `database_strategy IN ('shared','dedicated')`.
- `tenant_subscriptions.status`.
- Vários `updated_at >= created_at`.

Ausências relevantes (documentadas em auditorias anteriores):
- `valores_referencia.sexo` — sem CHECK.
- `valores_referencia.unidade_idade` — sem CHECK.
- `valores_referencia.tipo` — sem CHECK.
- `whatsapp_outbox.status` — validado apenas em app.

## UNIQUE constraints — 39
Cobrem chaves de negócio essenciais:
- `pacientes (tenant_id, cpf)` parcial.
- `atendimentos (tenant_id, protocolo)`.
- `exames_catalogo (tenant_id, codigo)`.
- `exame_parametros (exame_id, chave)`.
- `select_options (tenant_id, categoria, valor)`.
- `tenants.slug`, `tenants.subdominio`.
- `tenant_registry.tenant_id`.
- `profiles (user_id)`, `user_roles (user_id, role)`.
- `friendly_id_counters (tenant_id, scope)`, `guia_sequence`, `protocolo_sequence`, `amostra_sequence`.
- `convenio_faturas (tenant_id, convenio_id, competencia)`.

## NOT NULL
Praticamente todas as colunas de domínio são `NOT NULL`, incluindo `tenant_id`. Exceções:
- Campos opcionais (`especialista_id`, `convenio_id`, `terceirizado_id`, `observacoes`, `descricao`).
- `select_options.tenant_id NULL` (dicionário global — intencional).
- Alguns campos textuais legados em `valores_referencia` (`critico_min/max`).

## Integridade referencial — veredito factual
- Núcleo clínico e financeiro: **íntegro** (FKs presentes, cascatas coerentes).
- Auditoria: intencionalmente **sem FK** (imutabilidade histórica).
- Multi-tenant: **isolado por RLS**, não por FK.
- Catálogo de VR: única área com **integridade fraca** por escolha de tipos texto (documentado).
