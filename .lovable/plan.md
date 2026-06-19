
# Financeiro V2 — Laboratorial Simples e Profissional

Execução em sequência única conforme escolha. Toda mudança preserva multi-tenancy, RLS e histórico. Frontend lê; backend calcula.

## Premissas confirmadas

- Estratégia: tudo em sequência (11 fases) num único ciclo de implementação.
- Migrations: aprovadas para produção (cada fase com schema-change envia uma migration que você aprova em modal).
- DELETE físico: bloqueado **a partir do deploy** em `atendimento_pagamentos`, `convenio_faturas`, `financeiro_saidas`. Histórico anterior intacto. Super_admin segue regra geral (sem exceção).

## Escopo NÃO incluído (filosofia: laboratório, não ERP)

Plano de contas contábil, centro de custo, conciliação bancária, parcelamento de despesas, sangria/suprimento, múltiplas gavetas, glosa funcional (apenas estrutura), recebimento parcial de convênio funcional (apenas estrutura).

## Fases

### Fase 1 — SSOT do "A Receber"
- RPC única `financeiro_a_receber_v2(tenant, filtros)` retornando `{tipo: 'paciente'|'convenio', quem, quanto, desde, status}`.
- Remove caminho duplicado em `FinanceiroService.ts`. Feature flag antiga eliminada.
- Documento `docs/financeiro/ssot.md`.

### Fase 2 — Normalização de despesas
- Migration: `ALTER TABLE financeiro_saidas ADD COLUMN forma_pagamento text` (enum lógico: PIX, Dinheiro, Débito, Crédito, Transferência, Boleto).
- Backfill: parser do sufixo `[pgto:X]` na descrição → coluna nova; sufixo removido da descrição em UPDATE auditado.
- Compatibilidade: leitura via coluna; legados sem match ficam `NULL` (UI mostra "—").

### Fase 3 — Dashboard Financeiro
- Nova primeira tela `/financeiro`: 6 cards apenas — Receita Hoje, Receita Mês, A Receber, Despesas Mês, Saldo Atual, Convênios Pendentes.
- Remove gráficos/indicadores técnicos atuais.

### Fase 4 — Recebimentos
- Aba enxuta: Data, Paciente, Protocolo, Forma, Valor, Status. Filtros: Hoje, Semana, Mês, Período. Sem mais nada.

### Fase 5 — A Receber (split)
- Duas sub-abas claramente separadas: **Pacientes** | **Convênios**. Mesma estrutura de coluna (Quem, Quanto, Desde, Status). Sem mistura.

### Fase 6 — Despesas
- Form simplificado: Descrição, Categoria, Forma de Pagamento (coluna nova), Vencimento, Valor, Status.
- Status: Aberta, Paga, Cancelada. Migration adiciona `cancelada` ao domínio se ausente.

### Fase 7 — Convênios (área dedicada)
- Aba própria: Convênio · Faturas · Valor · Status.
- Migration prepara colunas em `convenio_faturas`: `valor_glosado numeric NULL`, `valor_recebido_parcial numeric NULL`, `motivo_glosa text NULL`. Apenas estrutura — sem UI funcional para glosa/parcial nesta entrega.

### Fase 8 — Caixa Operacional (opcional)
- `app_settings`: chave `usar_caixa_operacional` (bool, default `false`). Tenants atuais ficam exatamente como hoje.
- Migration nova tabela `caixa_sessoes` (tenant_id, unidade_id, aberta_em, fechada_em, responsavel_id, valor_abertura, valor_fechamento, observacoes, status). RLS por tenant + permissão `gestao_financeira` para abrir/fechar.
- Regras: 1 sessão aberta por unidade; recebimentos do dia se vinculam à sessão aberta quando flag ativa; sem sangria/suprimento.

### Fase 9 — Estorno formal
- Migration nova tabela `financeiro_estornos` (tenant_id, origem_tipo `pagamento|fatura|saida`, origem_id, motivo, valor, criado_por, criado_em).
- Triggers `BEFORE DELETE` em `atendimento_pagamentos`, `convenio_faturas`, `financeiro_saidas` com `RAISE EXCEPTION 'Use estorno'` — exceto registros criados antes do deploy (compatibilidade controlada por `created_at < deploy_ts` salvo em `app_settings`).
- UI: botão "Estornar" substitui "Excluir"; modal exige motivo.

### Fase 10 — Auditoria financeira
- Migration `financeiro_audit` (quem, quando, ação, entidade, antes/depois jsonb). Triggers em pagamentos, saídas, faturas, estornos, sessões de caixa.

### Fase 11 — UX
- Remoção de modais redundantes na navegação Financeiro.
- Nomenclatura unificada: "Receber", "Pagar", "Conferir".
- Texto explicativo zero — telas autoexplicativas.

## Validação ao final
- Build + TypeScript via harness.
- Smoke manual: criar atendimento → pagar → ver em Recebimentos → ver Dashboard atualizar; criar despesa com forma de pagamento; tentar DELETE (deve falhar); estornar (deve gerar registro + audit).
- RLS: querys cross-tenant rejeitadas (já garantido por `current_tenant_id()`; revalidar nas novas tabelas).

## Entregáveis

- Código nas pastas existentes (`src/pages/Financeiro*`, `src/services/financeiro*`, `src/data/financeiroStore.ts`).
- Migrations sequenciais (uma por fase com schema-change).
- `docs/financeiro/ssot.md`.
- `docs/financeiro-v2/financeiro-simples-profissional-report.md` respondendo às 7 perguntas de validação.

## Riscos e mitigação

- **Backfill de `[pgto:X]`**: registros sem padrão ficam NULL e são visíveis para correção manual; descrição original preservada em `financeiro_audit` antes do UPDATE.
- **Bloqueio de DELETE**: timestamp de corte (`deploy_ts`) em `app_settings` permite que registros antigos ainda possam ser removidos por compatibilidade enquanto novos exigem estorno.
- **Caixa opcional**: default `false` garante que nenhum tenant atual sofre mudança de fluxo sem opt-in explícito.
- **Reversão**: cada migration tem DOWN documentada no comentário SQL para rollback emergencial.

## Detalhes técnicos

- RPCs novas: `financeiro_a_receber_v2`, `financeiro_dashboard_kpis`, `financeiro_estornar(tipo, id, motivo)`.
- Permissões reaproveitam `visualizar_financeiro` (leitura) e `gestao_financeira` (mutação/estorno/caixa).
- QueryKeys seguem padrão `["tenant", tenantId, "financeiro", ...]`.
- Nenhuma alteração em Atendimento, Resultado, Portal, Coleta, Análise.
- Nenhuma alteração em rotas existentes além de `/financeiro` (dashboard interno reorganizado).

Aprove para eu iniciar pela Fase 1.
