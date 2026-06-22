# Financeiro 2.0 — Caixa Operacional · Alertas UX

**Status:** concluído.
**Escopo:** Fases 1 a 4 da missão "Melhoria de UX do Caixa Operacional".

Esta entrega é **exclusivamente de UX**. Não houve alteração no modelo
financeiro, em RLS, em policies, em triggers, em RPCs nem em edge functions.
Nenhuma tabela, coluna ou evento financeiro foi criado.

---

## O que foi implementado

### Fase 1 — Aviso único no primeiro Novo Atendimento do dia

Arquivo novo: `src/components/caixa/CaixaAlertaNovoAtendimento.tsx`
Montado em: `src/pages/NovoAtendimento.tsx` (apenas em criação, não em edição).

Fluxo:

1. Ao montar a tela `Novo Atendimento`, o componente resolve a unidade ativa
   do usuário (mesma resolução usada pelo `CaixaOperacionalCard`).
2. Consulta o `localStorage` por uma chave única daquele
   **dia × unidade × usuário**:

   ```
   caixa_alerta_2026-07-01_<unidadeId>_<userId>
   ```

3. Se a chave já existe → não faz nada.
4. Se a chave **não** existe → consulta `getCaixaAbertaPorUnidade(unidadeId)`.
   - Caixa aberto → silencia (nenhum aviso).
   - Caixa fechado → grava a chave no `localStorage` e abre o modal.

Modal:

- Título: **Caixa fechado**
- Mensagem informa que pagamentos em Dinheiro e PIX feitos sem caixa
  aberto não entram no fechamento, e pergunta se deseja abrir agora.
- Botões: `Continuar sem Caixa` (fecha o modal) e `Abrir Caixa`
  (abre o `AbrirCaixaDialog` já existente — **reutiliza** o fluxo de
  abertura do `CaixaOperacionalCard`, sem duplicar lógica nem formulário).

Gating: o componente só monta para usuários com permissão
`gestao_financeira`. Para os demais, retorna `null`.

### Fase 2 — Aviso leve no pagamento Dinheiro/PIX com caixa fechado

Arquivo alterado: `src/pages/NovoAtendimento.tsx` (callback `onConfirm` do
`PagamentoDialog`).

Após persistir os novos pagamentos no estado local, se algum deles for
`Dinheiro` ou `PIX`, consultamos `getCaixaAbertaPorUnidade(unidadeAtiva)`.
Se não houver caixa aberto, disparamos um `toast` discreto:

> **Pagamento registrado com o caixa fechado**
> Este valor não será incluído no fechamento do caixa até que uma sessão
> de caixa seja aberta.

Não bloqueia salvar, não bloqueia finalizar, não impede o fluxo.

### Fase 3 — Auditoria

Nenhuma alteração em `financeiro_audit`. Nenhuma nova tabela, evento ou
coluna. As consultas usadas (`getCaixaAbertaPorUnidade`) já existiam e
respeitam RLS por tenant.

### Fase 4 — Segurança

Nenhuma alteração em `tenant_id`, `current_tenant_id()`, `has_role()`,
`is_super_admin()`, RLS, policies, triggers, RPCs ou edge functions.

---

## Refatoração mínima

Para reutilizar o formulário de abertura sem duplicar código,
`AbrirCaixaDialog` em `src/components/caixa/CaixaOperacionalCard.tsx` foi
**exportado** (`export function`). O conteúdo do diálogo é idêntico ao que
já era usado pelo card no Dashboard e na aba Caixa do Financeiro.

---

## Validação dos cenários

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Caixa fechado → 1º Novo Atendimento | Modal aparece **uma vez** |
| 2 | Caixa fechado → 2º Novo Atendimento no mesmo dia (mesmo usuário/unidade) | Modal **não** aparece (chave já em `localStorage`) |
| 3 | Caixa aberto → Novo Atendimento | Nenhum aviso |
| 4 | Pagamento Dinheiro → caixa fechado | Toast exibido, pagamento salvo |
| 5 | Pagamento PIX → caixa fechado | Toast exibido, pagamento salvo |
| 6 | Pagamento Dinheiro ou PIX → caixa aberto | Nenhum aviso |

---

## Respostas obrigatórias

1. **O aviso aparece apenas uma vez por dia?** Sim — chave em
   `localStorage` por `data + unidade + usuário`.
2. **O aviso respeita usuário e unidade?** Sim — a chave inclui ambos.
3. **O fluxo de abertura foi reutilizado?** Sim — `AbrirCaixaDialog` é
   importado de `CaixaOperacionalCard.tsx`, sem duplicar formulário ou
   chamada à RPC.
4. **O pagamento continua funcionando?** Sim — o toast é assíncrono e não
   está no caminho crítico do salvamento.
5. **O toast aparece corretamente?** Sim — usa `@/hooks/use-toast`,
   padrão do projeto.
6. **Existe regressão financeira?** Não — nenhuma mudança em store,
   RPC ou tabela.
7. **Existe regressão operacional?** Não — fluxo opcional, sem bloqueios.
8. **Existe impacto em performance?** Mínimo: uma consulta extra ao
   abrir `Novo Atendimento` (apenas 1ª vez do dia) e uma consulta após
   confirmar pagamento Dinheiro/PIX. Ambas em `caixa_sessoes` por
   `unidade_id + status='aberta'` (índice existente).
9. **Existe impacto em auditoria?** Nenhum.
10. **A experiência ficou mais simples?** Sim — o recepcionista é
    lembrado no momento certo, sem novas telas, rotas ou wizards.

---

## Arquivos alterados / criados

- `src/components/caixa/CaixaAlertaNovoAtendimento.tsx` (novo)
- `src/components/caixa/CaixaOperacionalCard.tsx` (exporta `AbrirCaixaDialog`)
- `src/pages/NovoAtendimento.tsx` (import + montagem do alerta + toast no pagamento)
- `docs/financeiro/caixa-ux-alerts-report.md` (este relatório)

## Regra de parada

Encerrado. Não foi iniciado Caixa por Operador, múltiplos caixas ou
qualquer alteração ao modelo financeiro.
