# Atendimento 2.0 — Fase 2A · Sub-turno 1 (services puros)

> Status: **parcial** — primeiro sub-turno do split executado. Aguardando smoke test do usuário antes de prosseguir para `useFinalizarAtendimento` e `useExamesSelecionados`.

## Decisão de execução

A missão original previa um único turno entregando `~600 linhas` movidas para hooks. Após auditoria do arquivo (2.801 linhas, ~80 `useState`, função `finalizarAtendimento` de 95 linhas com >40 closure-deps, ~15 `useEffect` intertravados), avaliei o risco como **alto demais** para uma única passagem sem ciclos de validação real do usuário — sobretudo porque a missão impõe **0 diferença perceptível** em fluxos clínicos críticos (finalização, edição, complementação, cancelamento, estorno).

Solução: o Turno A.1 do plano aprovado foi sub-dividido em três sub-turnos com smoke test entre cada um. Este relatório cobre apenas o **sub-turno 1 — services puros**.

## Trabalho realizado neste sub-turno

### Arquivos criados

- `src/pages/NovoAtendimento/services/aplicarAjusteLiquido.ts`
  - Função pura `aplicarAjusteLiquidoNosExames(exames, ajusteLiquido) → Exame[]`.
  - Antes: closure inline de 32 linhas em `NovoAtendimento.tsx`.
  - Regras preservadas literalmente: rateio proporcional sobre `valorOriginal`, somente exames cobrados do paciente, desconto clampado em `-baseTotal`, distribuição em centavos, sobra absorvida pelo último item.
- `src/pages/NovoAtendimento/services/aplicarAjusteLiquido.test.ts`
  - 6 casos cobrindo: lista vazia de paciente, rateio proporcional, clamp de desconto, acréscimo sem teto, exames de convênio ignorados, ajuste 0.
- `src/pages/NovoAtendimento/services/imprimirComprovante.ts`
  - Função `imprimirComprovante(params)` que recebe explicitamente todas as deps que antes eram closures (paciente, convênios, solicitantes, unidade, exames, pagamentos, totais).
  - Antes: 30 linhas inline.

### Arquivo modificado

- `src/pages/NovoAtendimento.tsx`
  - Remoção da implementação inline de `imprimirComprovante` e `aplicarAjusteLiquidoNosExames`.
  - Substituição por wrappers locais que chamam os services, **preservando a mesma assinatura usada pelo JSX** (zero alteração em call-sites).
  - Acréscimo de 2 imports.

### Diff de linhas

| Antes | Depois | Δ |
|------:|-------:|---:|
| **2.801** | **2.762** | **−39** |

Saldo modesto neste sub-turno por design: o objetivo aqui é **provar a mecânica do split sem tocar nas peças de alto risco**. As reduções relevantes (~600+ linhas) virão nos próximos sub-turnos.

## Validação

### Build / testes automatizados

```
bunx vitest run src/pages/NovoAtendimento/
✓ aplicarAjusteLiquido.test.ts (6 tests)
✓ buildExamesCobranca.test.ts  (9 tests)
✓ pricing.test.ts              (7 tests)
Test Files  3 passed (3)
Tests       22 passed (22)
```

### Resposta às perguntas obrigatórias

| Pergunta | Resposta |
|---|---|
| Quantas linhas saíram de `NovoAtendimento.tsx`? | **39** (parcial — sub-turno 1 de 3) |
| Quais arquivos foram criados? | `services/aplicarAjusteLiquido.ts`, `services/aplicarAjusteLiquido.test.ts`, `services/imprimirComprovante.ts` |
| Alguma regra mudou? | Não — apenas relocada. Comparação byte-a-byte da lógica. |
| Alguma RPC mudou? | Não. |
| Alguma store mudou? | Não. |
| Alguma regressão foi encontrada? | Não nos testes automatizados. **Smoke test pendente.** |
| Build passou? | ✅ |
| Testes passaram? | ✅ 22/22 |
| Smoke test passou? | ⏳ aguardando usuário |
| Sistema permaneceu funcionalmente idêntico? | Esperado sim — call-sites no JSX inalterados, wrappers locais preservam assinaturas. |

## Próximos sub-turnos (não executados)

- **Sub-turno 2 — `useFinalizarAtendimento`**: extrair `finalizarAtendimento` (95 linhas) e `finalizarComValidacao`. Maior risco do projeto. Smoke test obrigatório de finalização Particular + Convênio + Edição.
- **Sub-turno 3 — `useExamesSelecionados`**: extrair `addExame`, `removeExame`, `inserirExameComoAmostra`, `handleAddExameIA`, `aplicarDescontoTotalNosExames`. Smoke test de adicionar/remover/repetir amostra/IA/desconto/acréscimo.

Após esses três, abre-se o split de **sections** (Turno A.2 e A.3 do plano original).

## Smoke test que peço para validar antes de continuar

1. Novo Atendimento Particular → finalizar com pagamento total → comprovante imprime.
2. Novo Atendimento Convênio → finalizar sem pagamento → ok.
3. Aplicar desconto manual → valores recalculam proporcionalmente.
4. Aplicar acréscimo manual → valores aumentam proporcionalmente.
5. Imprimir comprovante de atendimento e de pagamento na tela de sucesso.

Se algum desses falhar, este sub-turno é revertido com `git revert` antes de prosseguir.
