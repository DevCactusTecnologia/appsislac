# Financeiro — SSOT (Source of Truth)

> Documento da **Fase 1 do Financeiro V2 — Laboratorial Simples e Profissional**.
> Define a fonte única de verdade para o módulo "A Receber" do Financeiro.

## 1. Princípio

> **Frontend lê. Backend calcula.**

O cálculo de saldos a receber (pacientes e convênios) é feito **inteiramente no banco**,
respeitando RLS e isolamento por `tenant_id`. O frontend apenas consome o resultado.

## 2. Fonte oficial — `financeiro_a_receber_v2`

RPC PostgreSQL única, em `public.financeiro_a_receber_v2`.

### Assinatura

```sql
financeiro_a_receber_v2(
  p_tipo        text DEFAULT 'paciente',  -- 'paciente' | 'convenio'
  p_search      text DEFAULT NULL,
  p_date_from   timestamptz DEFAULT NULL,
  p_date_to     timestamptz DEFAULT NULL,
  p_status      text DEFAULT NULL,        -- 'parcial' | 'pendente' (apenas paciente)
  p_cursor_data timestamptz DEFAULT NULL,
  p_cursor_id   bigint DEFAULT NULL,
  p_limit       integer DEFAULT 50
)
RETURNS TABLE (
  tipo, ref_id, protocolo, data, quem, convenio_nome,
  valor_total, valor_pago, saldo, status,
  qtd_exames, qtd_pacientes
)
```

### Modos

| Modo (`p_tipo`) | Conteúdo                                                           | Paginação            |
| --------------- | ------------------------------------------------------------------ | -------------------- |
| `paciente`      | Atendimentos com saldo > 0 (cobrança ao paciente − pagamentos)      | Cursor (`data`,`id`) |
| `convenio`      | Saldo agregado por convênio (exames `cobranca_destino='convenio'` não faturados) | Sem paginação        |

### Regras de negócio (lado banco)

- **Pacientes**:
  `valor_total = SUM(valor) WHERE cobranca_destino='paciente'`
  `valor_pago  = SUM(atendimento_pagamentos.valor)`
  `saldo       = ROUND(valor_total - valor_pago, 2)`
  Inclui apenas `saldo > 0.009` e atendimentos não cancelados.
  `status = 'parcial'` quando `valor_pago > 0`, senão `'pendente'`.
- **Convênios**:
  Soma `atendimento_exames.valor` para exames com `cobranca_destino='convenio'`,
  status `<> 'cancelado'`, **que ainda não foram vinculados a uma fatura**
  (`NOT EXISTS` em `convenio_fatura_itens`). Ignora o convênio "Particular" (`id=0`).
  `status = 'aberto'`.
- **Multi-tenant**: todo `WHERE` filtra por `current_tenant_id()`. RLS preservado.

## 3. Consumo no frontend

### Hooks oficiais (`src/hooks/useAReceberPacientes.ts`)

- `useAReceberPacientes(enabled, filters)` — consome v2 com `p_tipo='paciente'`.
- `useAReceberConvenios(enabled, filters?)` — consome v2 com `p_tipo='convenio'`.

Ambos seguem o padrão de queryKey por tenant (defesa em profundidade) e atualizam
automaticamente após mutações via `subscribeAtendimentos`.

### Componente que orquestra

`src/pages/Financeiro.tsx` — usa **apenas** os hooks acima como fonte de A Receber.
Não há mais cálculo client-side a partir de `getAtendimentos()` para esse fim.

## 4. O que foi removido na Fase 1

- `buildAReceberRowsFromAtendimentos` (cálculo client-side a partir do cache).
- `buildAReceberConvenioRows` + `fetchSaldoEmAbertoPorConvenio` (caminho duplicado para convênios).
- Branching pela feature flag `paginated_atendimentos` para a fonte de A Receber.
  A flag continua existindo para o resumo agregado (`useFinanceiroResumo`), que será
  unificado em fase posterior.

## 5. O que NÃO mudou

- Fluxo de pagamento (`atendimento_pagamentos`) e fluxo de fechamento de fatura
  (`convenio_faturas` / `convenio_fatura_itens`) — comportamento idêntico.
- UI das sub-abas "Pacientes" e "Convênios" — mesmos campos, mesma ordem,
  mesmas ações (Pagar / Fechar fatura).
- RLS, permissões, isolamento por tenant.

## 6. Reversão

Caso necessário, a função pode ser revertida por:

```sql
DROP FUNCTION public.financeiro_a_receber_v2(
  text, text, timestamptz, timestamptz, text, timestamptz, bigint, integer
);
```

A RPC antiga `a_receber_pacientes_page` continua existindo no banco como
referência histórica; ela não é mais consumida pelo frontend a partir da Fase 1.
