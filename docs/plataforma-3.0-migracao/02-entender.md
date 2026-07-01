# Fase 3 · Etapa 2 — ENTENDER

Data: 2026-07-01
Precede: `01-radiografia.md`
Regra OECV: apenas **entender**. Nenhuma ação executada. Etapa 3 (CONFIGURAR) exige aprovação explícita.

---

## 1. Análise das 196 funções PL/pgSQL

| Métrica | Qtd | Impacto no destino dedicado |
|---|---:|---|
| Funções que chamam `current_tenant_id()` | 31 | Precisam ser **reescritas ou stubadas** — no dedicado não há tenant_id, `current_tenant_id()` deve retornar sempre um valor fixo (o próprio tenant) ou ser abolida |
| Funções que chamam `auth.uid()` | 43 | Continuam funcionando (dedicado tem `auth` próprio), mas `auth.uid()` retornará NULL nas chamadas server-side via anon key (Fase 2 confirmou que Auth fica no shared) |
| Funções `SECURITY DEFINER` | 140 | Precisam manter dono correto e `SET search_path = public` no destino |
| Funções que referenciam coluna `tenant_id` | 95 | Todas quebram se o destino não tiver a coluna; **decisão-chave** abaixo |
| Funções usadas por triggers | 106 | Devem ser criadas **antes** dos triggers |

### Decisão arquitetural crítica

Duas opções para o schema do dedicado:

**Opção A — "Puro" (sem `tenant_id`)**
- Isolamento = projeto Supabase.
- Requer reescrita de 95 funções + refatoração dos stores frontend para não enviar `tenant_id`.
- Alinhado com `.lovable/plan.md` original.
- **Custo:** alto (semanas). Risco de regressão em RPCs.

**Opção B — "Espelho" (mantém `tenant_id` fixo no dedicado)**
- Copia o schema idêntico ao shared, com `tenant_id` NOT NULL DEFAULT `<uuid-do-tenant>`.
- `current_tenant_id()` reescrita para retornar o UUID fixo do tenant proprietário do projeto.
- **Zero mudanças** no frontend e nas 196 funções.
- Isolamento continua sendo o projeto (tenant_id vira metadado, não filtro).
- **Custo:** baixo. É o caminho pragmático.

**Recomendação:** **Opção B**. O ganho da Opção A é estético (schema "puro"), mas quebra a compatibilidade e obriga refatorar todo o runtime. Com B, o mesmo código funciona em shared e dedicated.

---

## 2. Grafo de dependências entre tabelas

144 FKs internas ao `public`. Amostra crítica:

```text
tenants ← app_settings, unidades, convenios, pacientes, exames_catalogo, …
pacientes ← atendimentos ← atendimento_exames ← amostras
                       ← atendimento_pagamentos
convenios ← atendimento_exames
exames_catalogo ← atendimento_exames, amostras, tabela_preco_itens, exame_layouts, exame_parametros
materiais_amostra ← amostras
posicoes_galeria ← amostra_alocacoes
labs_apoio ← atendimento_exames
```

### Ordem de carga (níveis)

```text
Nível 0 (sem FKs internos ou só p/ tenants):
  tenants*, unidades, convenios, exames_catalogo, especialistas,
  materiais_amostra, motivos_cancelamento, recoletas_motivos,
  select_options, financeiro_*_dicionarios, setores_laboratoriais,
  posicoes_galeria, galerias, labs_apoio, documento_templates,
  reguas_etarias, locais_armazenamento, tenant_lab_config,
  tenant_payment_gateways, tenant_settings_public,
  friendly_id_counters, guia_sequence, amostra_sequence,
  protocolo_sequence

Nível 1:
  profiles, tabela_preco_itens, exame_layouts, exame_parametros,
  exame_pops, valores_referencia, mapas_trabalho, mapa_exames,
  orcamentos, pacientes

Nível 2:
  atendimentos, orcamento_exames, caixa_sessoes

Nível 3:
  atendimento_exames, atendimento_pagamentos

Nível 4:
  amostras, amostra_alocacoes, atendimento_audit,
  ai_audit, audit_logs, operational_audit, financeiro_audit,
  storage_audit, protocolo_auditoria

Nível 5:
  amostra_movimentacoes, amostra_emprestimos, comprovante_links,
  criticos_comunicacoes, resultados_entregas, orientacoes_entregues
```

`tenants` não vai para o dedicado (control plane), mas o `tenant_id` referenciado por FKs precisa apontar para uma linha "sentinela" no dedicado — ou a FK precisa ser dropada. **Consequência da Opção B:** criar 1 linha em `tenants` no dedicado com o mesmo UUID e manter as FKs.

### FKs auto-referentes

- `unidades.parent_id → unidades.id` — carregar em 2 passos: INSERT com `parent_id=NULL`, depois UPDATE.
- `convenio_faturas` — tabela vazia no 0001, não impacta.

---

## 3. Análise das 13 views

Todas dependem apenas de `pg_catalog` (dep type 2200 = pg_namespace). Nenhuma view depende de outra view diretamente. Ordem de criação: qualquer, após tabelas base e funções auxiliares.

**Nota:** `financeiro_entradas` é uma view derivada de `atendimento_pagamentos` — **não migrar como dado**, só recriar a definição.

---

## 4. `pg_cron` e `supabase_vault`

Sem permissão de leitura no shell (esperado — schemas privilegiados). Ação para Etapa 3:
- Listar `cron.job` via edge function com service role
- Listar `vault.secrets` via edge function com service role

**Hipótese de trabalho:** jobs `pg_cron` do shared (WhatsApp outbox, expurgo, health checks) são de **plataforma**, não de tenant. **Decisão:** não replicar para o dedicado. O shared continua orquestrando; o dedicado é apenas storage de domínio.

Vault: se houver secrets vinculados ao tenant 0001, migrar 1-a-1 via edge function. Se forem globais, ficam no shared.

---

## 5. Auth — plano concreto

- 2 usuários no `profiles` do tenant 0001.
- Edge migradora:
  1. Lê `profiles` do shared filtrado por tenant.
  2. Para cada `user_id`, chama `auth.admin.getUserById(id)` no shared.
  3. Chama `auth.admin.createUser({ id, email, email_confirm: true, user_metadata, app_metadata })` no dedicado.
  4. Precisamos investigar se o `password_hash` é retornado pela API admin. Se **não** for, opções:
     - a) Forçar reset de senha (envia magic-link no primeiro login).
     - b) Ler `auth.users.encrypted_password` via SQL direto (service role) e inserir no dedicado igualmente via SQL.
  5. Replica `user_roles` das linhas cujo `user_id` está entre os migrados.

**Recomendação:** iniciar por **(b)** (preserva senha, UX zero-friction). Se falhar, fallback para (a).

---

## 6. Storage — plano concreto

- 8 buckets no shared, 1 arquivo relevante para o tenant 0001 (`assinaturas`, 35 kB).
- Edge migradora:
  1. Cria os 8 buckets no dedicado com mesma visibilidade.
  2. Lista `storage.objects` filtrando por caminhos que contêm o tenant UUID ou UUIDs dos users migrados.
  3. Baixa via signed URL do shared → upload no dedicado.
  4. Grava manifest de arquivos migrados para auditoria.

---

## 7. Decisões finais das 6 perguntas em aberto

| # | Pergunta | Decisão proposta |
|---|---|---|
| 1 | Auditoria (~27k linhas) | **Truncar no destino** — auditoria é histórica e não impacta operação. Manter o shared como arquivo. Se precisar consultar, edge cross-project. |
| 2 | `pg_cron` | **Não replicar** — jobs continuam no shared (plataforma). |
| 3 | `cities`/`states` (5570+27) | **Copiar snapshot** — pequeno, evita cross-project em cadastros. |
| 4 | `supabase_vault` | Inventariar na Etapa 3 via edge. Provavelmente **não migrar** (secrets são de plataforma). |
| 5 | Cutover | **Janela de manutenção curta** (~5 min): shared read-only → migração delta → flip do `runtime_dedicated_enabled` global. Volume é trivial. |
| 6 | Rollback | Manter shared populado por **30 dias** com flag `frozen_at`. Depois arquivar dump `.sql.gz` e purgar linhas do tenant. |

---

## 8. Plano de execução (Etapa 3 — CONFIGURAR)

Ordem obrigatória, cada bloco = 1 entrega:

1. **Edge `super-admin-provision-tenant-schema-full`** — replica schema inteiro (extensões → enums → funções auxiliares → tabelas na ordem topológica → índices → triggers → views → GRANTs).
   - Reutiliza a introspecção do shared via `pg_dump --schema-only` executado dentro da própria edge (via `pg_catalog` puro, sem CLI).
   - Idempotente (drop cascade prévio protegido por flag).
2. **Edge `super-admin-migrate-tenant-auth`** — copia `auth.users` + `user_roles` preservando IDs e hash de senha.
3. **Edge `super-admin-migrate-tenant-data`** — copia dados na ordem topológica, dropando auditoria, com transação por bloco e checkpoint.
   - Cria a linha sentinela em `tenants` no dedicado (Opção B).
   - Dispara `SET session_replication_role = replica` para desligar triggers durante a carga.
4. **Edge `super-admin-migrate-tenant-storage`** — cria buckets + copia objetos filtrados.
5. **UI `SuperAdminMigration.tsx`** — wizard com 4 passos, progress bar, logs em tempo real via Realtime, botão de rollback.
6. **Smoke test automatizado** — script Playwright que loga no lab 0001 dedicado e valida: paciente aparece, exame catalogado, atendimento antigo abre, layout imprime.

---

## 9. Riscos residuais após Etapa 2

| Risco | Mitigação |
|---|---|
| Hash de senha não migrar | Fallback = reset por email |
| Alguma função referenciar `tenants` global | Opção B cria sentinela → resolve |
| Volume real crescer antes do cutover | Migração delta na janela |
| Divergência de versão de extensão entre shared/dedicated | Verificar `extversion` na etapa de provisionamento |

---

## Regra de parada — PARAR AQUI

Etapa 2 (ENTENDER) concluída. Aguardo aprovação explícita para iniciar Etapa 3 (**CONFIGURAR**).

**Confirmar antes de prosseguir:**
1. Aprova a **Opção B (Espelho com tenant_id fixo)** como modelo do dedicado? ✅ / ❌
2. Aprova **truncar auditoria** no destino? ✅ / ❌
3. Aprova **não replicar `pg_cron`** no destino? ✅ / ❌
4. Aprova a estratégia **cutover com janela curta** (~5 min)? ✅ / ❌
