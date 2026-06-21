
# Plano — Financeiro 2.0 (laboratorial, simples, profissional)

> **Modo:** somente plano. Nenhuma migration / código nessa rodada.
> **Base:** auditoria já existente em `docs/financeiro-audit/*` e `docs/financeiro/ssot.md`.
> **Decisões já confirmadas:** caixa por unidade (Dinheiro + PIX presencial); não dropar tabelas; DELETE será decidido após a Fase 1.
> **Constraint do projeto:** mudanças estruturais (rotas, contextos, boot, deps) só com "sim" explícito por fase.

---

## Estado atual relevante (já em produção)

- `financeiro_estornos` **já existe** com RPC `financeiro_estornar(p_id, p_motivo, p_tipo)` e UI `EstornarDialog` ligada em `Financeiro.tsx` para os 3 tipos (`pagamento` | `fatura` | `saida`). O Estorno Formal da Fase 3 já está parcialmente implementado.
- `financeiro_a_receber_v2` é a SSOT oficial de A Receber (Fase 7 já está praticamente entregue).
- `caixa_sessoes` existe no schema mas tem **zero uso** no `src/`. É o esqueleto para Fases 5–6.
- `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`: tabelas legadas, sem leitura/escrita pelo código atual. Decisão do usuário: **não dropar**, apenas documentar.
- `atendimento_pagamentos` ainda permite DELETE (RLS exige `admin`). Fluxo destrutivo continua possível.
- Forma de pagamento de saída codificada em `[pgto:X]` na descrição (sem coluna).
- `atendimentos` não persiste `desconto`/`acrescimo` explicitamente — desconto é distribuído proporcionalmente em `atendimento_exames.desconto`; acréscimo não existe formalmente.

---

## Fases — ordem de execução proposta

### Fase 1 — Auditoria final + SSOT consolidado *(sem código)*

- Reusar `docs/financeiro-audit/ssot-report.md` + `docs/financeiro/ssot.md`.
- Entregar `docs/financeiro/financial-ssot-final.md` com tabela única respondendo "qual é a fonte oficial de cada valor", já refletindo o que existe (estorno, a-receber-v2) e o que falta.
- Fechar 4 decisões pendentes para liberar Fase 2+:
  1. DELETE em `atendimento_pagamentos` para admin: revogar ou manter como escape hatch?
  2. Acréscimo: persistir em `atendimentos.acrescimo_valor` (escalar) ou em `atendimento_exames.acrescimo` (distribuído)?
  3. Caixa: 1 sessão por unidade *aberta*, mas operadores múltiplos podem lançar nela? (assumido: sim)
  4. Forma de pagamento de saída: migrar para coluna dedicada agora ou manter `[pgto:X]`?

### Fase 2 — Pagamentos aditivos *(migration + UI)*

- Manter `INSERT` em `atendimento_pagamentos` (já é o caminho atual).
- Substituir todos os pontos de UI que hoje permitem editar/excluir pagamento por: **estornar** (cria linha em `financeiro_estornos`, marca pagamento como `estornado_em`/`estornado_por`/`estorno_motivo`).
- Migration: adicionar colunas `estornado_em timestamptz`, `estornado_por uuid`, `estorno_motivo text` em `atendimento_pagamentos`; ajustar `trg_recompute_on_pagamento_change` para ignorar pagamentos estornados; ajustar view `financeiro_entradas` para excluir estornados.
- RLS: revogar DELETE conforme decisão da Fase 1.

### Fase 3 — Estorno formal unificado *(consolidação)*

- `financeiro_estornos` + `financeiro_estornar()` já são SSOT. Tarefas:
  - Garantir que os 3 tipos (`pagamento`, `fatura`, `saida`) gravem motivo, usuário, data, valor, origem.
  - Substituir o "marcar fatura cancelada" e o "deletar saída" por chamadas ao RPC.
  - Tela `/financeiro` ganha aba/sub-aba "Estornos" lendo de `financeiro_estornos`.

### Fase 4 — Desconto + Acréscimo persistidos *(migration + form)*

- Adicionar em `atendimentos`: `desconto_total numeric`, `acrescimo_total numeric`, `subtotal_bruto numeric`, `total_liquido numeric` (todos derivados, mas materializados para auditoria/relatório).
- Trigger recomputa esses 4 campos a cada mutação de `atendimento_exames`.
- Distribuição proporcional do desconto continua client-side em `distribuirDescontoEntreExames` (intocada).
- Acréscimo: campo único no atendimento (não distribui); soma direto em `total_liquido`.
- UI `NovoAtendimento.tsx`: bloco "Resumo" passa a mostrar `subtotal / desconto / acréscimo / total` lendo do atendimento.

### Fase 5 — Caixa operacional *(migration + nova UI)*

- Usar `caixa_sessoes` (já existe). Esquema confirmado: `unidade_id`, `aberto_em`, `fechado_em`, `saldo_inicial`, `aberto_por`, `fechado_por`, `tenant_id`.
- Regra: **1 sessão `aberta` por `unidade_id`** (constraint parcial unique).
- Vincular ao caixa **apenas** pagamentos com `tipo IN ('Dinheiro','PIX')` e `unidade_id` da sessão aberta. Demais (cartão, convênio, faturamento) seguem fora.
- Adicionar `caixa_sessao_id` em `atendimento_pagamentos` e `financeiro_saidas` (nullable; preenchido só quando aplicável).

### Fase 6 — Abrir / Fechar caixa *(UI + RPC)*

- 2 RPCs: `caixa_abrir(unidade_id, saldo_inicial)` e `caixa_fechar(sessao_id, saldo_contado, observacao)`.
- Tela `/financeiro` ganha aba "Caixa Operacional" (substitui o atual "Caixa" derivado, que vira "Livro-caixa" — relatório).
- Fechamento gera comprovante imprimível com saldo inicial / entradas / saídas / saldo esperado / saldo contado / divergência.

### Fase 7 — A Receber *(consolidação — quase pronto)*

- `financeiro_a_receber_v2` já é SSOT. Tarefas residuais:
  - Remover `a_receber_pacientes_page` legado (banco mantém função; código já não chama).
  - Confirmar que `useFinanceiroResumo` também usa v2 ou unificar nessa fase.
  - Documentar no relatório final.

### Fase 8 — UX por papel *(sem migration; reorganização de UI)*

- Recepção (`registrar_pagamento`): vê em `/atendimentos/.../editar` apenas Receber + Imprimir comprovante + Finalizar.
- Financeiro (`gestao_financeira`): aba `Caixa Operacional`, `Recebimentos`, `Estornos`, `A Receber`.
- Gestor (`visualizar_financeiro`): `Painel` (KPIs), `Livro-caixa`, `Convênios`.
- Implementação: gating já existe via `has_permission`; só ajustar `baseTabs` em `Financeiro/types.ts`.

### Fase 9 — Limpeza *(remoções confirmadas pelo usuário)*

- **Não dropar tabelas** (decisão do usuário). Apenas documentar `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` como legado no relatório.
- Remover do frontend (TS/TSX): qualquer store, helper ou import que ficar com 0 referência após Fases 2–7. Candidatos atuais conhecidos:
  - `buildAReceberRowsFromAtendimentos` (já removido na Fase 1 antiga — confirmar).
  - `buildAReceberConvenioRows`, `fetchSaldoEmAbertoPorConvenio` (idem).
  - Branching `paginated_atendimentos` em pontos restantes.
- Critério: **0 referências, 0 imports, 0 consumidores** antes de remover.

### Fase 10 — Relatório executivo *(sem código)*

- `docs/financeiro/financeiro-2.0-report.md` respondendo as 10 perguntas da missão, com diff antes/depois e checklist verificável.

---

## Ordem sugerida de execução (com checkpoints)

```
Fase 1  ── decisões 1-4 ──► Fase 2 ──► Fase 3 ──► Fase 4
                                                     │
                                                     ▼
                                  Fase 5 ──► Fase 6 ──► Fase 7
                                                     │
                                                     ▼
                                            Fase 8 ──► Fase 9 ──► Fase 10
```

Checkpoint após cada fase: tela do módulo abre sem regressão, comprovantes intactos, RLS preservado, tenants isolados.

---

## Fora de escopo (regra de parada)

- Plano de contas / DRE / centro de custo / contábil / conciliação bancária.
- Glosa estruturada / recurso / parcial de fatura de convênio.
- Comissão de solicitante.
- Mudanças em laudo, CKEditor, mapa, etiquetas, billing de plataforma (super-admin), orçamento.

---

## O que preciso do usuário antes de começar a Fase 2

1. Aprovar o plano acima.
2. Responder as 4 decisões pendentes da Fase 1 (DELETE, acréscimo, caixa multi-operador, forma de pagamento de saída).
3. Confirmar se quer que eu execute fase a fase com revisão entre elas, ou rode 1→4 numa rodada e 5→10 em outra.

