# Convênios 2.0 — Fase 3 · Relatório Final

**Data:** 2026-06-22  
**Escopo:** Glosa formal e Reapresentação auditável  
**Status:** ✅ Concluído

---

## 1. Entregas

### 1.1 Modelagem (Fase 3.1)

Tabela nova:

```sql
public.convenio_glosas (
  id, tenant_id,
  fatura_id            -- fatura sob glosa
  fatura_item_id       -- item específico (sempre presente nesta versão)
  valor_original       -- snapshot imutável
  valor_glosado        -- ≤ valor_original
  motivo               -- obrigatório
  status               -- aberta | reapresentada | aceita_perda | cancelada
  reapresentada_em_fatura_id, reapresentada_em, reapresentada_por
  cancelada_em, cancelada_por, motivo_cancelamento
  created_at, created_by, updated_at, observacao
)
```

- **CHECK** `valor_glosado ≤ valor_original` no banco.
- **Sem DELETE**: a tabela proíbe `DELETE` (sem policy correspondente). Cancelamento é via `status='cancelada'`.
- RLS por tenant; `gestao_financeira` cria/edita; `visualizar_financeiro` lê.

Extensões em `convenio_faturas`:

| Coluna | Função |
|---|---|
| `fatura_origem_id` | aponta para a fatura raiz quando esta é uma reapresentação |
| `tentativa` | inteiro: 1 = original, 2 = primeira reapresentação, etc. |

### 1.2 Glosa parcial (Fase 3.2)

```
Fatura  = R$ 1.000  (3 itens)
Glosa   = R$ 200    (1 item, parcial)
Saldo   = R$ 800
```

Registrada via RPC:

```sql
SELECT public.convenio_fatura_glosar(
  p_fatura_id := <fid>,
  p_motivo    := 'Item não autorizado',
  p_itens     := '[{"item_id": 42, "valor_glosado": 200.00}]'::jsonb
);
```

A fatura **continua aberta**. Itens não-glosados permanecem normais.  
A view `convenio_fatura_resumo` calcula `saldo_pendente = total − total_glosado`.

### 1.3 Glosa total (Fase 3.3)

```
Fatura = R$ 1.000  (3 itens)
Glosa  = todos itens (R$ 1.000)
```

Mesma RPC, todos os itens listados. Nenhum item ou linha é apagada.  
A fatura mantém status `aberta` ou `paga` — o que muda é o `saldo_pendente=0` no resumo SSOT.

### 1.4 Reapresentação (Fase 3.4)

Vínculo formal:

```
Fatura origem (T1)
   ↓  glosas abertas selecionadas
Reapresentação (T2)  fatura_origem_id = T1
   ↓
Reapresentação (T3)  fatura_origem_id = T1, tentativa = 3
```

RPC:

```sql
SELECT public.convenio_fatura_reapresentar(
  p_fatura_origem_id := <fid>,
  p_glosa_ids        := ARRAY[<gid1>, <gid2>],
  p_motivo           := 'Documentação corrigida',
  p_periodo_inicio   := CURRENT_DATE,
  p_periodo_fim      := CURRENT_DATE
);
```

Efeitos:
- Cria nova `convenio_faturas` com `tentativa = max(cadeia)+1`.
- Copia para a nova fatura **apenas os itens** referenciados pelas glosas escolhidas (com a `valor` original).
- Marca cada glosa como `status='reapresentada'`, gravando `reapresentada_em_fatura_id`, `reapresentada_em` e `reapresentada_por`.
- Bloqueia se algum exame já pertencer a outra fatura ativa (proteção de duplicidade).

### 1.5 SSOT (Fase 3.5)

View `convenio_fatura_resumo` (security_invoker):

| Campo | Definição |
|---|---|
| `total_faturado` | `convenio_faturas.total` |
| `total_recebido` | `total` quando `status='paga'`, senão 0 |
| `total_glosado` | Σ `valor_glosado` (aberta + reapresentada + aceita_perda) |
| `total_glosado_aberto` | Σ `valor_glosado` somente status=`aberta` |
| `total_reapresentado` | Σ `valor_glosado` status=`reapresentada` |
| `saldo_pendente` | `total − total_glosado` (0 se paga ou cancelada) |

Esta view é a **única fonte de verdade** para qualquer KPI de glosa/reapresentação.

### 1.6 Auditoria (Fase 3.6)

Trigger `trg_audit_convenio_glosas` registra em `financeiro_audit`:

| Evento | `acao` |
|---|---|
| Criar glosa | `glosa_criada` |
| Reapresentar (status: aberta → reapresentada) | `glosa_reapresentada` |
| Cancelar glosa | `glosa_cancelada` |
| Editar motivo | `glosa_motivo_editado` |
| Outras updates | `glosa_atualizada` |

Cada linha guarda `antes`/`depois` (jsonb) e `ator_id` (`auth.uid()`).

A criação da nova fatura via reapresentação dispara também `trg_audit_convenio_faturas` (Fase 2), gerando rastro encadeado: `glosa_reapresentada` + `fatura_criada`.

### 1.7 UX (Fase 3.7)

**Sem rotas novas. Sem wizards. Sem telas novas grandes.**

Apenas o `FaturaDetalheDialog` ganhou:

- Cards SSOT no topo (Faturado / Recebido / Glosado / Reapresentado / Saldo).
- Cadeia visual de tentativas (`T1 · FAT-2026-0000123 · R$ 1.000 · paga` → `T2 · ...`).
- Botão **Glosar itens** → abre formulário inline com checkboxes + campo de valor por item.
- Botão **Reapresentar glosas** → abre formulário inline com checkboxes nas glosas abertas.
- Botão (ícone) para **Cancelar glosa** individual.
- Lista das glosas registradas (data, motivo, valores, status).

---

## 2. Limpeza

| Item | Ação |
|---|---|
| Fluxo "cancelar fatura → refaturar" como substituto de glosa | **Mantido apenas para casos legítimos** (cancelamento real). A glosa agora é o caminho oficial — `cancelarFatura` só cancela; quem precisar reapresentar usa o novo botão. |
| `fetchSaldoEmAbertoPorConvenio` | Já removido na Fase 2.5. |
| Cálculo de glosado/reapresentado no front | **Não existia**; nasceu já em SSOT (view). |

Nenhum código legado foi reintroduzido.

---

## 3. Segurança

| Garantia | Status |
|---|---|
| `tenant_id` obrigatório, default `current_tenant_id()` | ✅ |
| RLS habilitada em `convenio_glosas` | ✅ (4 policies: select/insert/update + sem delete) |
| Operações via RPC `SECURITY DEFINER` com revalidação `has_permission` | ✅ |
| Trigger de assinatura HMAC em faturas (Fase 1) | ✅ preservado, vale também para a fatura de reapresentação |
| Trigger `protect_convenio_fatura_paga` | ✅ preservado |
| Trigger de auditoria nas faturas (Fase 2) | ✅ preservado |

Nenhum trigger ou policy existente foi alterado/derrubado.

---

## 4. Validação

| Cenário | Resultado |
|---|---|
| Glosa parcial (R$ 200 de R$ 1.000) | `saldo_pendente=800`, fatura segue aberta |
| Glosa total (todos os itens) | `saldo_pendente=0`, itens íntegros, motivo registrado |
| Reapresentação simples (T1→T2) | Nova fatura com `tentativa=2`, glosas marcadas como `reapresentada` |
| Múltiplas reapresentações (T1→T2→T3) | `tentativa` corretamente incrementado a partir do `MAX` da cadeia |
| Tentativa de glosa duplicada no mesmo item | Bloqueada (`'já existe glosa aberta para o item'`) |
| Tentativa de reapresentar exame já em outra fatura ativa | Bloqueada |
| Cancelamento de glosa | Status muda para `cancelada`, evento auditado, valor sai do `total_glosado_aberto` |
| KPIs do A Receber e Dashboard | Inalterados (continuam consumindo `financeiro_a_receber_v2/totais`); glosas afetam apenas `convenio_fatura_resumo` |

Sem regressão observada.

---

## 5. Respostas obrigatórias

| Pergunta | Resposta |
|---|---|
| Existe glosa formal? | **Sim** — tabela `convenio_glosas` + RPC `convenio_fatura_glosar`. |
| Existe glosa parcial? | **Sim** — `valor_glosado < valor_original`. |
| Existe glosa total? | **Sim** — `valor_glosado = valor_original` em todos os itens. |
| Existe reapresentação? | **Sim** — `convenio_fatura_reapresentar` + cadeia `fatura_origem_id`/`tentativa`. |
| Existe trilha completa? | **Sim** — `financeiro_audit` registra criar/editar/reapresentar/cancelar; FK garantem rastreabilidade. |
| Existe SSOT? | **Sim** — view `convenio_fatura_resumo`. |
| Existe auditoria? | **Sim** — trigger `trg_audit_convenio_glosas` + auditoria já vigente em `convenio_faturas`. |
| Existe código legado removido? | **Nada novo a remover** — limpeza relevante já feita na Fase 2. |
| Existe regressão? | **Não** — KPIs do A Receber/Caixa intocados; UI só ganhou seções novas no dialog existente. |
| Está pronto para Competência? | **Sim** — domínio com fonte de verdade, eventos auditáveis e cadeia formal de faturas. |

---

## 6. Regra de parada

Concluído. Não foi iniciado: Competência, Recebimento Parcial, TISS, XML, integração com operadora, ERP.
