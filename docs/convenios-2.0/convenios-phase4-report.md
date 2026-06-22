# Convênios 2.0 — Fase 4: Competência e Fechamento Mensal

**Data:** 2026-06-22
**Escopo:** Modelagem de competência, vinculação automática de faturas, fechamento e reabertura controlada, travamento operacional no banco, SSOT por competência, auditoria.

---

## 1. Modelagem de Competência

Tabela `public.convenio_competencias`:

| Campo                | Tipo        | Observação                                         |
|----------------------|-------------|----------------------------------------------------|
| id                   | bigserial   | PK                                                 |
| tenant_id            | uuid        | default `current_tenant_id()`                      |
| competencia          | text        | formato `YYYY-MM`, único por tenant                |
| status               | text        | `aberta` \| `fechada`                              |
| aberta_em / aberta_por           | timestamptz / uuid | quem e quando abriu                |
| fechada_em / fechada_por         | timestamptz / uuid | preenchidos no fechamento          |
| reaberta_em / reaberta_por       | timestamptz / uuid | preenchidos na reabertura          |
| motivo_reabertura    | text        | obrigatório no `competencia_reabrir`               |
| observacao           | text        | comentário livre                                   |

- RLS: `SELECT` requer `visualizar_financeiro` (ou super_admin); `INSERT/UPDATE` requerem `gestao_financeira`. Sem `DELETE`.
- Constraint de formato (`^\d{4}-(0[1-9]|1[0-2])$`) garante competência válida.
- Unicidade por `(tenant_id, competencia)`.
- `updated_at` mantido por trigger.

## 2. Vinculação das Faturas

- Coluna `convenio_faturas.competencia text NOT NULL` adicionada.
- Trigger `trg_convenio_fatura_set_competencia` (BEFORE INSERT/UPDATE OF periodo_fim) deriva automaticamente `to_char(periodo_fim, 'YYYY-MM')`.
- Backfill aplicado em todas as faturas existentes.
- Índice `idx_convenio_faturas_competencia (tenant_id, competencia)`.
- Frontend (`convenioFaturasStore.criarFatura`) passa `competencia` derivada de `periodoFim` (o trigger sobrescreve — defesa em profundidade, sem dependência do front).

## 3. Travamento Operacional (regras vivem no banco)

Helper `competencia_esta_fechada(tenant, comp)` consultado por três triggers BEFORE INSERT/UPDATE/DELETE:

| Tabela                    | Trigger                              | Bloqueio                                                |
|---------------------------|--------------------------------------|---------------------------------------------------------|
| `convenio_faturas`        | `trg_guard_fatura_competencia`       | criação, alteração estrutural ou exclusão em comp. fechada. Apenas `observacao` continua editável. |
| `convenio_fatura_itens`   | `trg_guard_fatura_item_competencia`  | INSERT/UPDATE/DELETE de itens cuja fatura está em comp. fechada |
| `convenio_glosas`         | `trg_guard_glosa_competencia`        | INSERT/UPDATE/DELETE de glosas em comp. fechada         |

Em todos os casos: `RAISE EXCEPTION USING ERRCODE = '42501'`.

## 4. RPCs de Governança

- `competencia_abrir(p_competencia text)` — idempotente; reabre se a linha existir como `fechada` apenas via `competencia_reabrir`.
- `competencia_fechar(p_competencia text, p_observacao text DEFAULT '')` — exige `gestao_financeira`; cria a linha se não existir e marca `fechada`. Persiste `fechada_em`, `fechada_por`, `observacao`.
- `competencia_reabrir(p_competencia text, p_motivo text)` — exige `is_super_admin()` OU `has_role(uid, 'admin')`; motivo obrigatório; persiste `reaberta_em`, `reaberta_por`, `motivo_reabertura`.

Todas com `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` apenas para `authenticated`.

## 5. Auditoria

- Trigger `trg_audit_convenio_competencias` registra em `financeiro_audit` as ações:
  - `competencia_aberta`
  - `competencia_fechada`
  - `competencia_reaberta`
  - `competencia_observacao_editada`
  - `competencia_atualizada`
- `antes` e `depois` em JSONB; `ator_id = auth.uid()`.

## 6. SSOT por Competência

View `public.convenio_competencia_resumo` (security_invoker = on):

```sql
SELECT tenant_id, competencia, status,
       fechada_em, fechada_por, aberta_em, aberta_por,
       qtd_faturas,
       total_faturado,
       total_recebido,
       total_cancelado,
       total_glosado,
       total_reapresentado,
       total_glosado_aberto,
       saldo_pendente
  FROM convenio_competencia_resumo;
```

Saldo = `total_faturado - total_recebido - total_cancelado - total_glosado_aberto`.

`FULL OUTER JOIN` entre faturas agregadas e a tabela de competências garante que mesmo competências sem faturas (ou faturas em meses sem competência aberta) apareçam.

GRANT SELECT a `authenticated` e `service_role`. Nenhum KPI calculado no frontend.

## 7. UI

- Componente `CompetenciaAtualCard` (`src/components/financeiro/CompetenciaAtualCard.tsx`):
  - Cabeçalho com competência atual e badge de status (Aberta/Fechada).
  - Cinco KPIs lado a lado: Faturado · Recebido · Glosado · Reapresentado · Saldo.
  - Botão "Fechar competência" (gestão financeira) e "Reabrir" (apenas admin/super_admin).
  - Diálogos para observação (fechar) e motivo (reabrir, obrigatório).
  - Consome unicamente `convenio_competencia_resumo`.
- Renderizado no topo da aba **Convênios** em `/financeiro` (`ConveniosTab.tsx`).

## 8. Frontend store

- Novo `src/data/convenioCompetenciasStore.ts` expondo:
  - `fetchCompetenciasResumo()`
  - `fetchCompetenciaAtual()`
  - `abrirCompetencia(yyyymm)`
  - `fecharCompetencia(yyyymm, observacao?)`
  - `reabrirCompetencia(yyyymm, motivo)`

## 9. Limpeza

Não havia consultas paralelas, KPIs duplicados ou helpers órfãos relacionados a competência (conceito inexistente antes da Fase 4). Nenhuma remoção foi necessária além da defesa em profundidade já feita nas Fases 2/3 (DELETE eliminado, fetchSaldoEmAbertoPorConvenio removido, KPIs do A Receber centralizados na RPC v2).

## 10. Validação

| Cenário                                                         | Resultado esperado                                  |
|-----------------------------------------------------------------|-----------------------------------------------------|
| Criar fatura cuja `periodo_fim` cai em competência aberta        | OK; competência preenchida pelo trigger             |
| Criar fatura cuja `periodo_fim` cai em competência fechada       | Bloqueada (`42501`)                                 |
| Adicionar item a fatura em competência fechada                   | Bloqueado (`42501`)                                 |
| Glosa em fatura de competência fechada                           | Bloqueado (`42501`)                                 |
| Reapresentação dentro de competência fechada                     | Bloqueada (insere fatura → trigger guarda)          |
| `competencia_fechar` sem permissão                               | `42501`                                             |
| `competencia_reabrir` por usuário não-admin                      | `42501`                                             |
| `competencia_reabrir` sem motivo                                 | erro                                                |
| KPIs do card                                                    | refletem `convenio_competencia_resumo` em tempo real |

Sem perda histórica (nenhum DELETE). SSOT preservado. Sem regressão observada nas faturas e glosas existentes.

## 11. Resposta às perguntas-chave

| Pergunta                                          | Status |
|---------------------------------------------------|--------|
| Existe competência formal?                        | Sim — `convenio_competencias` |
| Existe fechamento mensal?                         | Sim — `competencia_fechar` |
| Existe travamento operacional?                    | Sim — 3 triggers no banco |
| Existe reabertura controlada?                     | Sim — `competencia_reabrir` (admin + motivo) |
| Existe SSOT por competência?                      | Sim — `convenio_competencia_resumo` |
| Existe auditoria?                                 | Sim — `financeiro_audit` via trigger dedicado |
| Existe cálculo paralelo?                          | Não — todos os KPIs vêm da view |
| Existe código morto removido?                     | N/A para esta fase (nada redundante introduzido) |
| Existe regressão?                                 | Não detectada |
| Convênios 2.0 está concluído?                     | Sim — encerramento formal do domínio |

---

## Cadeia final do domínio

```
Competência (aberta)
    ↓
Faturas
    ↓
Glosas
    ↓
Reapresentações (nova fatura, mesma competência ou seguinte)
    ↓
Recebimentos
    ↓
Fechamento (lock total no banco)
    ↓
Reabertura (admin + motivo, auditada)
```

Tudo auditável. Tudo rastreável. Tudo com SSOT.

**Convênios 2.0 — encerrado.**
