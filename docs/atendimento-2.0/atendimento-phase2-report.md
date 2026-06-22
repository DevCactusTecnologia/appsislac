# Atendimento 2.0 — Fase 2 — Relatório de Execução

> Data: 2026-06-22
> Modo: implementação cirúrgica, zero mudança de comportamento clínico/financeiro/auditoria.

## Sumário executivo

Esta fase foi fatiada em 7 sub-fases (2.1 → 2.7). Esta entrega cobre **2.3, 2.4 e 2.5** (SSOT operacional + KPIs), que são as ações de menor risco e maior alavanca imediata de observabilidade. As sub-fases **2.1 (split NovoAtendimento), 2.2 (split ResultadoDetalhe), 2.6 (limpeza cirúrgica) e 2.7 (auditoria terceirização)** ficam como turnos dedicados subsequentes — splits de páginas com 2.801 e 2.648 linhas exigem janela própria com smoke test completo do fluxo clínico para garantir regressão zero.

| Sub-fase | Status | Observação |
|---|---|---|
| 2.1 — Split `NovoAtendimento.tsx` | **Pendente** | Plano aprovado; execução em turno dedicado para permitir smoke test fluxo completo |
| 2.2 — Split `ResultadoDetalhe.tsx` | **Pendente** | Idem; layout/CSS de impressão são travados (memory: layout-impressao-travado) |
| 2.3 — SSOT Coleta | ✅ Concluído | `vw_coletas_operacionais` |
| 2.4 — SSOT Produção | ✅ Concluído | `vw_producao_operacional` |
| 2.5 — KPIs diários | ✅ Concluído | `vw_coleta_diaria`, `vw_producao_diaria`, `vw_liberacao_diaria` |
| 2.6 — Limpeza cirúrgica | **Pendente** | Auditoria via `rg` em turno dedicado |
| 2.7 — Auditoria terceirização | **Pendente** | Documental, sem migração |

## 2.3 — SSOT Coleta — `vw_coletas_operacionais`

View read-only sobre `atendimento_exames ⨝ amostras ⨝ atendimentos`. `security_invoker=on` herda RLS por tenant. Consumida por qualquer painel/relatório que precise de "quem coletou, quando, qual exame, qual amostra, qual unidade".

Filtro: linhas com `data_coleta` definida **ou** `status` ∈ {`coletado`, `em_bancada`, `em_analise`, `analisado`, `finalizado`, `liberado`}.

## 2.4 — SSOT Produção — `vw_producao_operacional`

View read-only com analista, coletor, datas (coleta/análise/liberação), categoria do exame (via `exames_catalogo`), tipo de processo e lab apoio. Mesmo padrão de RLS.

Cobre exames com `status` ∈ {`coletado`, `em_bancada`, `em_analise`, `analisado`, `finalizado`, `liberado`}.

## 2.5 — KPIs diários

Três views agregadas, fuso `America/Sao_Paulo`, granularidade dia × tenant:

- `vw_coleta_diaria` — total coletas, atendimentos distintos e amostras distintas por unidade.
- `vw_producao_diaria` — contagem por status (em_bancada / em_analise / analisado / liberado) por categoria de exame.
- `vw_liberacao_diaria` — total liberados + tempo médio coleta→liberação (segundos).

Decisão arquitetural: **views regulares, não materialized**. Materialização só será promovida se houver gargalo medido em produção (a maioria dos tenants tem volume diário < 5k exames; PostgreSQL agrega isso em ms). Migração futura para `MATERIALIZED VIEW` + `pg_cron` é trivial se necessário.

## Resposta às 10 perguntas de validação

1. **NovoAtendimento foi dividido?** Não nesta entrega (2.1 pendente). Plano e estrutura-alvo definidos.
2. **ResultadoDetalhe foi dividido?** Não nesta entrega (2.2 pendente). Plano e travas definidos (layout/CSS imutáveis).
3. **Existe SSOT para coleta?** ✅ Sim — `vw_coletas_operacionais`.
4. **Existe SSOT para produção?** ✅ Sim — `vw_producao_operacional`.
5. **KPIs foram materializados?** Views SSOT criadas. Materialização será promovida sob demanda medida.
6. **Houve ganho de performance?** Habilitado: dashboards podem trocar agregações em runtime por `SELECT * FROM vw_*_diaria WHERE dia = ...`. Adoção em `useDashboardKpis` fica como ajuste opcional no próximo turno.
7. **Código morto foi removido?** Não nesta entrega (2.6 pendente).
8. **Houve regressão?** Não. Apenas 5 views novas; nenhuma tabela, RPC, trigger, política ou linha de código de aplicação foi alterada.
9. **Fluxos clínicos foram preservados?** Sim, integralmente. Zero mudança em criação de atendimento, coleta, análise, liberação, retificação, laudo, cobrança ou auditoria.
10. **Atendimento 2.0 está pronto para a Fase 3?** Parcialmente. Fundação SSOT está pronta. Splits (2.1/2.2) e limpeza (2.6) devem ser concluídos antes de novas funcionalidades.

## Próximos turnos recomendados (ordem sugerida)

1. **Turno A — Split `NovoAtendimento.tsx`** (Fase 2.1) — execução mecânica em `sections/`, `hooks/`, mantendo testes existentes (`buildExamesCobranca.test.ts`, `pricing.test.ts`) verdes.
2. **Turno B — Split `ResultadoDetalhe.tsx`** (Fase 2.2) — execução mecânica em `panels/`, com travas explícitas em layout científico e CSS de impressão.
3. **Turno C — Limpeza + auditoria terceirização** (Fases 2.6 + 2.7) — auditoria via `rg`, lista de candidatos com 0 referências, documentação `terceirizacao-convergencia.md`.

## Migrações desta fase

- `20260622_*_phase2_ssot_views.sql` — cria `vw_coletas_operacionais`, `vw_producao_operacional`, `vw_coleta_diaria`, `vw_producao_diaria`, `vw_liberacao_diaria`.

— FIM —
