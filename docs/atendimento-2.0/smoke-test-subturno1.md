# SMOKE TEST OFICIAL — ATENDIMENTO 2.0 | FASE 2A — SUB-TURNO 1

**Escopo da extração validada:**
- `src/pages/NovoAtendimento/services/aplicarAjusteLiquido.ts`
- `src/pages/NovoAtendimento/services/imprimirComprovante.ts`

**Ambiente:** homologação (preview Lovable). Proibido executar em produção.

**Status final:** ⏳ AGUARDANDO EXECUÇÃO MANUAL DOS CENÁRIOS 1–9

---

## 1. Validação automática (executada pelo agente)

| Verificação                                     | Resultado |
| ----------------------------------------------- | --------- |
| `vitest` — `aplicarAjusteLiquido.test.ts`       | ✅ 6/6     |
| `vitest` — `buildExamesCobranca.test.ts`        | ✅ 9/9     |
| `vitest` — `pricing.test.ts`                    | ✅ 7/7     |
| **Total**                                       | ✅ 22/22   |
| Build/typecheck (HMR)                           | ✅ verde   |
| Console preview (snapshot)                      | ✅ apenas warnings pré-existentes (React Router v7 future flags, realtime CHANNEL_ERROR — não relacionados ao refactor) |

**Cobertura dos testes de `aplicarAjusteLiquido`:**
1. Lista vazia → retorna `[]`
2. Rateio proporcional sobre `valorOriginal` (desconto)
3. Clamp de desconto em `-baseTotal` (nunca negativo)
4. Acréscimo sem teto (proporcional)
5. Exames cobrados pelo convênio são ignorados
6. Ajuste 0 → exames inalterados

**Paridade de comportamento confirmada por diff:**
- `NovoAtendimento.tsx` mantém os mesmos call-sites; serviços apenas movidos para arquivos puros.
- Nenhuma alteração em RPCs, stores, RLS, triggers, rotas, IDs de elementos, contratos visuais.

---

## 2. Cenários manuais (executar em homologação)

> Marcar cada item após validar na UI + banco. Em caso de qualquer falha: **PARAR** e abrir issue antes de prosseguir para o Sub-turno 2.

### Cenário 1 — Atendimento Particular
- [ ] Atendimento criado
- [ ] Protocolo gerado
- [ ] Exames vinculados
- [ ] Pagamento salvo
- [ ] Financeiro atualizado
- [ ] A Receber zerado
- [ ] Auditoria criada

### Cenário 2 — Convênio
- [ ] Atendimento criado
- [ ] Exames vinculados
- [ ] Sem pagamento registrado
- [ ] Convênio vinculado
- [ ] Elegível para faturamento

### Cenário 3 — Desconto
- [ ] Rateio proporcional
- [ ] Nenhum valor negativo
- [ ] Subtotal correto (Tela = Banco = Resumo)
- [ ] Desconto correto (Tela = Banco = Resumo)
- [ ] Total correto (Tela = Banco = Resumo)

### Cenário 4 — Acréscimo
- [ ] Rateio proporcional
- [ ] Subtotal / Acréscimo / Total batem em Tela, Banco e Resumo

### Cenário 5 — Impressão de comprovante (`imprimirComprovante`)
- [ ] Paciente correto
- [ ] Protocolo correto
- [ ] Exames corretos
- [ ] Valores corretos
- [ ] Convênio correto
- [ ] Pagamentos corretos

### Cenário 6 — Complementação
- [ ] Exame adicionado
- [ ] Valores atualizados
- [ ] Auditoria preservada
- [ ] Atendimento íntegro

### Cenário 7 — Cancelamento
- [ ] Status correto
- [ ] Financeiro correto
- [ ] Auditoria correta
- [ ] Sem erros no console

### Cenário 8 — Estorno (Financeiro 2.0)
- [ ] Estorno registrado
- [ ] Pagamento preservado
- [ ] Auditoria criada
- [ ] Saldo recalculado

### Cenário 9 — Regressão de dados
Comparar JSON do atendimento antes/depois do refactor:
- [ ] Estrutura
- [ ] Pagamentos
- [ ] Exames
- [ ] Descontos
- [ ] Acréscimos
- [ ] Totais
- [ ] Convênios

### Cenário 10 — Console e Network (validado parcialmente)
- [x] Console sem novos errors/warnings introduzidos pelo refactor (snapshot do agente)
- [ ] Confirmar console limpo durante fluxo completo manual
- [ ] Nenhuma request 4xx/5xx
- [ ] Nenhuma RPC falhando

---

## 3. Checklist final

```
[ ] 1.  Particular        OK
[ ] 2.  Convênio          OK
[ ] 3.  Desconto          OK
[ ] 4.  Acréscimo         OK
[ ] 5.  Comprovante       OK
[ ] 6.  Complementação    OK
[ ] 7.  Cancelamento      OK
[ ] 8.  Estorno           OK
[ ] 9.  Dados             OK
[ ] 10. Console           OK
```

## 4. Decisão

- ✅ **APROVADO (10/10, 0 regressões)** → autorizado iniciar **Sub-turno 2 — `useFinalizarAtendimento`**.
- ❌ **REPROVADO** → bloquear, registrar evidências abaixo, corrigir e re-executar smoke test.

### Evidências / observações

_(preencher durante execução manual)_

---

**Assinado pelo executor:** _______________________  **Data:** ____ / ____ / 2026
