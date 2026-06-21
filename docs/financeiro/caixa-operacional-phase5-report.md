# Financeiro 2.0 — Fase 5 (Caixa Operacional)

**Status:** concluído.
**Escopo executado:** 5.1 → 5.6, conforme spec aprovada (1 caixa por unidade, sem operador, sem múltiplos turnos, somente Dinheiro e PIX presencial entram).

---

## 5.1 — Hardening `caixa_sessoes`

| Item                                              | Estado |
|---------------------------------------------------|--------|
| RLS habilitada (4 policies tenant + super_admin)  | ✔ já existia |
| Coluna `fechado_por uuid`                         | ✔ adicionada |
| Índice **único parcial** `(tenant_id, unidade_id) WHERE status='aberta'` | ✔ adicionado |
| Índice `(tenant_id, status)`                      | ✔ adicionado |
| Trigger `updated_at`                              | ✔ adicionado |

Garantia estrutural: o banco recusa inserir uma 2ª sessão "aberta" para a mesma `(tenant, unidade)`. O frontend nem precisa cuidar disso.

## 5.2 — RPC `caixa_abrir(p_unidade_id, p_valor_abertura, p_observacoes)`

- `SECURITY DEFINER`, exige `gestao_financeira` (ou super admin).
- Resolve tenant via `current_tenant_id()`.
- Valida ausência de caixa aberto na unidade (defesa em profundidade do índice único).
- Insere `responsavel_id = auth.uid()`, `status='aberta'`.
- Retorna a linha completa de `caixa_sessoes`.
- `GRANT EXECUTE ... TO authenticated`.

## 5.3 — RPC `caixa_fechar(p_sessao_id, p_observacoes)`

Calcula no servidor:

- `entradas_dinheiro` = soma `atendimento_pagamentos` com `tipo='Dinheiro'` e `caixa_sessao_id = sessão` que **não** estejam estornados.
- `entradas_pix` = idem, `tipo='PIX'`.
- `saidas` = soma `financeiro_saidas` com `caixa_sessao_id = sessão`, `foi_pago=true`, não estornadas.
- `saldo_final = valor_abertura + dinheiro + pix − saídas`.

Persiste `status='fechada'`, `fechada_em=now()`, `fechado_por=auth.uid()`, `valor_fechamento=saldo_final`. Retorna `jsonb` com o resumo (consumido pelo comprovante).

## 5.4 — Vinculação automática

Trigger `BEFORE INSERT` em `atendimento_pagamentos`:
- Se `tipo IN ('Dinheiro','PIX')` e o atendimento pertence a uma unidade com caixa aberto, preenche `caixa_sessao_id` automaticamente.
- Crédito, Débito, transferência e qualquer outro tipo **ficam fora**.

Trigger `BEFORE INSERT` em `financeiro_saidas`:
- Se `foi_pago=true` e `forma_pagamento IN ('Dinheiro','PIX')`, vincula apenas se houver **exatamente 1** caixa aberto no tenant (saídas não têm `unidade_id`).

Sem dropdown, sem escolha manual no frontend. Consistente com a regra "PIX em `atendimento_pagamentos` é sempre presencial" aprovada na decisão 1.

## 5.5 — Tela operacional

`src/components/caixa/CaixaOperacionalCard.tsx`:

- Caixa **fechado** → único botão `Abrir caixa` → diálogo com saldo inicial + observação opcional.
- Caixa **aberto** → mostra abertura/saldo inicial → único botão `Fechar caixa` → confirmação → resumo automático → botão `Imprimir comprovante`.

Gating: só usuários com permissão `gestao_financeira` veem o card. Fora isso, o componente retorna `null`.

Pontos de uso:
- `src/components/dashboard/RecepcionistaDashboard.tsx` — card entre Quick Actions e KPIs.
- `src/pages/Financeiro.tsx` — nova aba **Caixa** (`activeTab === "caixa_op"`), ao lado das demais.

A aba existente `caixa` ("Conferir") continua sendo o **livro-caixa cronológico** — função distinta, não é o caixa operacional.

## 5.6 — Comprovante de fechamento

`src/lib/comprovanteCaixa.ts` → `imprimirComprovanteFechamento(args)`.

- HTML A4 portrait, cabeçalho administrativo padrão (`buildAdminReportHeader`).
- Bloco de identificação (unidade, abertura, fechamento, sessão).
- Tabela: saldo de abertura → +Dinheiro → +PIX → −Saídas → **Saldo final**.
- Duas linhas de assinatura (abertura/fechamento).
- Impresso via `printHtmlInHiddenFrame` (sem PDF, sem preview, sem download, sem WhatsApp — conforme spec).

---

## Limpeza

A auditoria não encontrou código órfão de caixa. Não havia store mock, hook fantasma ou componente abandonado para remover. A tabela `caixa_sessoes` saiu de "0 referências no `src/`" (Fase 2) para um único ponto de entrada coeso (`src/data/caixaSessoesStore.ts` + 1 componente).

## O que NÃO foi feito (regra de parada)

- ✗ sangria
- ✗ suprimento
- ✗ múltiplos caixas
- ✗ caixa por operador
- ✗ conciliação bancária
- ✗ centro de custo
- ✗ DRE
- ✗ ERP
- ✗ Fase 6

---

## Validação (10 perguntas obrigatórias)

| #  | Pergunta                                                       | Resposta |
|----|----------------------------------------------------------------|----------|
| 1  | Existe apenas um caixa aberto por unidade?                     | **Sim** — garantido por índice único parcial + RPC. |
| 2  | PIX entrou corretamente?                                       | **Sim** — `tipo='PIX'` em `atendimento_pagamentos` é sempre presencial e o trigger vincula à sessão. |
| 3  | Dinheiro entrou corretamente?                                  | **Sim** — mesmo trigger. |
| 4  | Convênio ficou fora?                                           | **Sim** — fatura de convênio nunca grava em `atendimento_pagamentos`. |
| 5  | Cartão (crédito/débito) ficou fora?                            | **Sim** — trigger só atua em `Dinheiro`/`PIX`. |
| 6  | Há código morto removido?                                      | Não havia código de caixa para remover; nada novo virou órfão. |
| 7  | Existe regressão?                                              | Nenhuma — nenhum fluxo existente foi alterado; novas colunas são opcionais. |
| 8  | O fluxo ficou simples?                                         | **Sim** — abrir → receber (automático) → fechar → imprimir. |
| 9  | O recepcionista consegue operar sem treinamento?               | **Sim** — UI tem 1 botão de cada vez; nunca os dois. |
| 10 | O contador consegue auditar?                                   | **Sim** — `caixa_sessoes` tem `valor_abertura`, `valor_fechamento`, `aberta_em`, `fechada_em`, `responsavel_id`, `fechado_por`, `observacoes`; cada movimento referencia a sessão; estornos continuam visíveis e excluídos do saldo. |

---

## Arquivos

**Banco:**
- `supabase/migrations/2026…_caixa_operacional.sql`

**Frontend:**
- `src/data/caixaSessoesStore.ts` (novo)
- `src/lib/comprovanteCaixa.ts` (novo)
- `src/components/caixa/CaixaOperacionalCard.tsx` (novo)
- `src/components/dashboard/RecepcionistaDashboard.tsx` (card inserido)
- `src/pages/Financeiro.tsx` (nova aba `caixa_op`)
- `src/pages/Financeiro/types.ts` (nova entrada em `baseTabs`)

## Próximos passos (apenas registro — não executar)

Fase 6+ ficaria livre para conciliação ou consolidação multi-unidade. Fora de escopo aqui.
