# /novo-atendimento — Single Source of Truth

> Auditoria de duplicação de estado e de cálculo.

## 1. Estado: duplicação real

### 1.1 `pacienteQuery` (string) **+** `selectedPaciente` (objeto)
- `:114` e `:116`. Coexistem porque o input é livre (busca/digite) e o
  vínculo é por seleção. **Justificado**, mas exige sincronização manual
  (vide `:251–256`, `:407–408`).

### 1.2 `convenios` (selecionados) **+** `availableConvenios` (catálogo) **+** `convenioQuery` (busca)
- `:265–293`. Três fontes coexistem por design (selecionados vs. opções
  vs. busca). **OK**, mas `availableConvenios` é snapshot reativo
  recomputado por `subscribeConvenios` — duplica a "fonte de verdade" da
  store no estado local.

### 1.3 `solicitantes` / `availableSolicitantes` / `solicitanteQuery`
- Espelho exato do caso 1.2. Mesma análise.

### 1.4 `availableExames` (state) ↔ `tabelaPrecoStore`
- `:90–95`. Snapshot local hidratado por `subscribeTabelaPreco`.
  Equivalente conceitualmente a um `useSyncExternalStore` artesanal.
  **Justificado** pela arquitetura legada (Zustand custom), mas é
  duplicação de fato.

### 1.5 Modo edição: `original*` vs. atual
- `originalPaciente`, `originalConvenios`, `originalSolicitantes`,
  `originalExameNames` (`:375–378`). Servem para flag de "hasChanges".
  **Padrão correto** (snapshot vs. estado vivo), não é duplicação ruim.

### 1.6 `editAtendimentoData` usado como **sinal de re-render**
- `:392` — anti-pattern documentado em comentário. Estado serve a dois
  propósitos (dado + trigger). **Hotspot**.

### 1.7 `pagamentosRealizados` (state) ↔ histórico do atendimento
- `:370`, `:417`. Em edição, é hidratado da store; em criação, vive só
  no componente até o submit. Não há duplicação persistente — OK.

## 2. Cálculo: duplicação real

### 2.1 Preço de exame (4 sítios)
**Fórmula canônica**:
```ts
getPrecoExame(nome, tabelaDoConvenio) ?? getPrecoExame(nome, "Própria") ?? 0
```
Reimplementada em:
- `:159–162` — débitos do paciente
- `:424–427` — hidratação edit (total)
- `:455–457` — hidratação edit (exame)
- `:650` — função `resolvePreco`

**Veredito**: 🔴 **fonte única não respeitada**. `resolvePreco` deveria
ser a única.

### 2.2 Status de pagamento
- Computado 2× neste arquivo (`:518–522` e `:554–558`) e em outros 2
  lugares do projeto (`Financeiro.tsx`, `PagamentoDialog.tsx` — vide
  `docs/governance/single-source-of-truth-audit.md §2`).
- Já listado como hotspot global a extrair em
  `src/lib/finance/statusPagamento.ts`. **Não corrigir aqui** — corrigir
  na governança.

### 2.3 Payload `examesCobranca`
- Construído 2× (`:531–545` e `:570–584`) com 14 linhas idênticas.
  Função pura óbvia ausente.

### 2.4 Distribuição de desconto
- Cálculo único (`:490–513`), local, sem duplicação. ✅

### 2.5 Total/Subtotal/Saldo
- Único sítio (`:618–621`). ✅ Mas a regra "convênio não absorve desconto"
  vive **apenas aqui** — não é replicada server-side. Aceitável porque o
  backend persiste o valor já abatido em `examesCobranca[i].valor`.

### 2.6 Resolução de cobrança (`resolveCobrancaDefault`)
- Centralizada em `helpers.ts` e chamada em 4 pontos. ✅ Fonte única
  respeitada.

### 2.7 Derivação de status do atendimento
- O componente seta apenas `{ label: "Pedido Realizado", type: "neutral" }`
  no create. Toda derivação posterior é server-side (triggers). ✅
  Documentado em `docs/governance/single-source-of-truth-audit.md §1`.

## 3. Mapa consolidado das fontes de verdade

| Conceito | Fonte canônica | Espelhos detectados |
|---|---|---|
| Tenant | `current_tenant_id()` SQL | `tenantResolver.ts` (read-only) |
| Status atendimento | DB triggers | `atendimentoStore.deriveStatus` (mirror) |
| Status pagamento | derivação | 4 sítios (NovoAtendimento ×2 + Financeiro + Dialog) 🔴 |
| Preço de exame | `tabelaPrecoStore.getPrecoExame` | **4 reimplementações do fallback** 🔴 |
| Cobrança híbrida default | `resolveCobrancaDefault` (helpers) | ✅ único |
| Distribuição de desconto | `finalizarAtendimento` local | ✅ único |
| `examesCobranca` payload | inline 2× | 🔴 duplicado |
| Paciente selecionado | `selectedPaciente` | + `pacienteQuery` (espelho UI) |
| Catálogo de exames | `tabelaPrecoStore` + `exameCatalogoStore` | `availableExames` (snapshot) |
| Convênios | `convenioStore` | `availableConvenios` (snapshot) |
| Solicitantes | `especialistaStore` | `availableSolicitantes` (snapshot) |
| Persistência | RPC transacional | edge functions (proxy) |
| Permissões | `has_permission` SQL | `useAuth().hasPermission` (UI mirror) |

## 4. Veredito

- **Estado UI**: duplicação aceitável (snapshots reativos de stores). 1
  anti-pattern documentado (`editAtendimentoData` como sinal).
- **Regra de negócio**: 2 violações reais — preço (4×) e payload
  `examesCobranca` (2×). Ambas locais ao arquivo, ambas resolvíveis com
  funções puras já parcialmente existentes.
- **Backend**: ✅ fonte única respeitada (RPC + RLS + triggers).
