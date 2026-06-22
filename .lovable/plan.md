
# Atendimento 2.0 — Fase 2 — Plano de Execução

> Esta fase mexe em estrutura (split de páginas grandes, novas views no banco, remoção de código morto). Pela regra do projeto, **preciso de "sim" explícito antes de executar**. Abaixo está o plano detalhado, fatiado em sub-fases independentes — você pode aprovar tudo ou só parte.

## Princípios (não-negociáveis)

- Zero mudança de comportamento clínico, fluxo, protocolo, RLS, auditoria, financeiro, convênios.
- Zero alteração de UX visível (mesmas rotas, mesmos cliques, mesmos resultados).
- Split é **mecânico**: extrair seções inteiras para arquivos menores, sem reescrever lógica.
- Cada sub-fase termina com build verde + smoke test manual antes de avançar.

---

## Fase 2.1 — Split `NovoAtendimento.tsx` (2801 linhas)

Estrutura alvo (`src/pages/NovoAtendimento/`):

```text
NovoAtendimento.tsx                 (orquestrador, ~300 linhas: estado raiz + composição)
sections/
  PacienteSection.tsx               (busca/seleção/cadastro rápido de paciente)
  SolicitanteSection.tsx            (solicitante(s), unidade, data)
  ConveniosSection.tsx              (convênios + resync de cobrança)
  ExamesSection.tsx                 (catálogo, busca, IA, lista de exames)
  FinanceiroSection.tsx             (cobrança, desconto, pagamentos)
  ResumoSection.tsx                 (resumo + finalizar/imprimir)
hooks/
  useAtendimentoForm.ts             (estado central + setters + dirty)
  useExamesSelecionados.ts          (add/remove/atualizar exames + cobrança)
  useFinalizarAtendimento.ts        (orquestra submit/edge function)
services/
  buildExamesCobranca.ts            (já existe)
  contarEtiquetas.ts                (já existe)
  distribuirDesconto.ts             (já existe)
  resyncCobrancaConvenios.ts        (já existe)
  pricing.ts                        (já existe)
  helpers.ts                        (já existe)
```

Regras: cada `Section` recebe props do `useAtendimentoForm`; nada de novo store global; mesmos imports externos; testes existentes (`buildExamesCobranca.test.ts`, `pricing.test.ts`) devem continuar passando sem alteração.

## Fase 2.2 — Split `ResultadoDetalhe.tsx` (2648 linhas)

Estrutura alvo (`src/pages/ResultadoDetalhe/`):

```text
index.tsx                           (orquestrador + tabs, ~300 linhas)
panels/
  ParametrosPanel.tsx               (form científico + valores)
  CriticosPanel.tsx                 (RDC 786, comunicações)
  LiberacaoPanel.tsx                (validação clínica, assinatura, liberar)
  ImpressaoPanel.tsx                (laudo, PDF, override)
  HistoricoPanel.tsx                (auditoria + retificações + entregas)
hooks/
  useResultadoExame.ts              (carga + patch via update_atendimento_exame_tx)
  useLiberacaoFlow.ts
services/                           (já existe — preservar)
  auditLogBuilder.ts
  criticoPipeline.ts
  laudoHtmlBuilder.ts
```

**Trava explícita**: `LayoutScientificFormRenderer`, `formula.ts`, `helpers.ts`, `statusHelpers.ts`, layout de impressão e CSS de laudo permanecem **byte-a-byte iguais** (memory: layout-impressao-travado).

## Fase 2.3 — SSOT Coleta (view `vw_coletas_operacionais`)

Migration somente-leitura sobre `atendimento_exames` + `amostras`:

```sql
CREATE VIEW public.vw_coletas_operacionais AS
SELECT
  ae.tenant_id, ae.atendimento_id, ae.id AS atendimento_exame_id,
  ae.exame_nome, ae.status, ae.coletado_por, ae.data_coleta,
  a.id AS amostra_id, a.codigo AS amostra_codigo, a.tipo_material,
  at.unidade_id, at.protocolo
FROM public.atendimento_exames ae
LEFT JOIN public.amostras a ON a.atendimento_exame_id = ae.id
JOIN public.atendimentos at ON at.id = ae.atendimento_id
WHERE ae.data_coleta IS NOT NULL OR ae.status IN ('coletado','em_bancada','em_analise','analisado','finalizado');
-- + GRANT SELECT TO authenticated; + security_invoker=on (herda RLS das tabelas-base)
```

Sem alterar telas. Apenas habilita consumo futuro.

## Fase 2.4 — SSOT Produção (`vw_producao_operacional`)

Análoga, focada em status `em_bancada | em_analise | analisado` com analista, setor (via `setor_id` no catálogo), data prevista x realizada.

## Fase 2.5 — KPIs materializados

Três views agregadas por dia/tenant:

- `vw_coleta_diaria` — total coletas, por unidade, tempo médio recepção→coleta.
- `vw_producao_diaria` — total em bancada/análise, por setor.
- `vw_liberacao_diaria` — total liberados, tempo médio coleta→liberação.

Padrão: **views regulares** (não materialized) com `security_invoker=on` para preservar RLS por tenant. Se houver pressão de performance real medida, promovemos a `MATERIALIZED VIEW` em fase futura. `useDashboardKpis` passa a poder consumir essas views (ajuste opcional, não obrigatório nesta fase).

## Fase 2.6 — Limpeza cirúrgica

Critério estrito: **0 imports + 0 referências** (verificado via `rg`). Candidatos serão listados no relatório antes de remover. Sem tocar em componentes, RPCs, triggers, tabelas.

## Fase 2.7 — Auditoria `lab-apoio-*` / `integration-*`

Apenas documental: gerar `docs/atendimento-2.0/terceirizacao-convergencia.md` mapeando sobreposições e plano futuro. **Nenhuma migração ou remoção.**

## Validação por sub-fase

1. `bun run build` verde.
2. `bunx vitest run` verde (testes de pricing/buildExamesCobranca obrigatórios).
3. Smoke manual: criar atendimento → coletar → analisar → liberar → imprimir laudo → pagar → estornar. Compare protocolo/laudo/auditoria com baseline.

## Relatório final

`docs/atendimento-2.0/atendimento-phase2-report.md` respondendo às 10 perguntas da missão, com diff de linhas por arquivo, lista de views criadas, lista de remoções e evidências de regressão zero.

---

## Como você quer prosseguir?

1. **Aprovar tudo** — executo 2.1 → 2.7 sequencialmente, parando entre sub-fases para você validar.
2. **Aprovar só uma sub-fase** — diga qual (ex.: "só 2.3 e 2.4 agora"). As views SSOT são as mais seguras e independentes.
3. **Ajustar plano** — peça mudanças (ex.: split diferente, materialized view em vez de view, etc.).

Recomendo começar por **2.3 + 2.4 + 2.5** (views SSOT — risco baixíssimo, ganho imediato de observabilidade) e só depois encarar os splits 2.1/2.2, que são mais invasivos.
