# /novo-atendimento — Risk Analysis

> Riscos identificados a partir da leitura do código. Sem hipóteses;
> cada item cita evidência.

## 1. Gargalos de manutenção (12 meses)

### 1.1 Arquivo monolítico (2.598 linhas) — **CRÍTICO**
- Único componente concentra: stepper, 3 dropdowns custom, IA, soroteca,
  cobrança híbrida, lab apoio, prefill web, edição com hidratação dupla,
  desconto proporcional, geração de PDF/orçamento, comprovantes, sucesso.
- Risco: qualquer evolução exige reler o arquivo inteiro. Conflitos de
  merge garantidos em time > 1 dev.

### 1.2 ~38 `useState` no mesmo escopo — **ALTO**
- Estado disperso (paciente, convênios, solicitantes, exames, IA, leitura,
  pagamento, edição, sucesso, prefill, orçamento). Sem `useReducer` /
  máquina de estado / store local.
- Risco: efeitos cruzados; já existe um effect (`:627–645`) reescrevendo
  `exames` quando `convenios` muda — padrão típico que gera loops futuros.

### 1.3 Hidratação por "sinal" (`setEditAtendimentoData`) — **MÉDIO**
- `:381–470` usa um state como gatilho de re-execução do próprio effect.
  Funcional, mas frágil a refatorações.

### 1.4 Dependência de stores legadas globais (sem React Query) — **MÉDIO**
- Stores Zustand custom (`subscribeConvenios`, `subscribeTabelaPreco`,
  `subscribeEspecialistas`) e snapshots `compute*` recomputados via effect.
  Sem cache key tenant-prefixed local — depende da governança global
  (`mem://architecture/query-key-rules`).

### 1.5 Duplicação de cálculo de preço — **ALTO**
- 4 sítios reimplementam o mesmo fallback (vide complexity audit §2.1).
  Qualquer mudança na regra exige editar 4 lugares.

## 2. Gargalos de performance (evidências)

### 2.1 Listeners globais não limpos por dropdown
- 3 effects `mousedown` em `window`/`document` (`:170–180`, `:309–321`,
  `:123–137`). OK individualmente; preocupação cresce se a página for
  reaberta intensivamente (potencial de listeners órfãos se algum cleanup
  falhar). Hoje cleanups existem.

### 2.2 Recomputação completa em cada keystroke do filtro
- `availableExames`, `availableConvenios`, `availableSolicitantes` são
  arrays reconstruídos a cada mutação dos stores. Sem `useMemo` em alguns
  filtros derivados (`filteredExames` em `:742` é cálculo barato; OK).

### 2.3 `pacienteHistorico` busca **server-side a cada troca de paciente**
- `:141–148` chama `fetchAtendimentosByPacienteCpf` com `limit: 50` para
  detectar débitos. Aceitável, mas multiplicado por cliques rápidos em
  pacientes diferentes pode gerar requests redundantes (sem debounce/
  cancelamento além do flag `alive`).

### 2.4 Lazy loading aplicado corretamente
- 7 dialogs pesados são `lazy(() => import(...))`. ✅ bom padrão; reduz
  bundle inicial.

### 2.5 Sem virtualização nas listas de exames/convênios
- Listas de busca renderizam todos os resultados filtrados. Para tenants
  com >5k itens no catálogo isso pode pesar (não é o caso atual; risco
  latente).

## 3. Gargalos de escalabilidade

### 3.1 100 laboratórios (tenants)
- ✅ Persistência transacional via RPC, tenant_id resolvido server-side
  (`current_tenant_id()`), RLS em todas as tabelas. **Isolamento ok**.
- ⚠️ Stores globais não são por-tenant no client. Troca de tenant
  (impersonation super_admin) exige reset — depende da governança de
  cache (memória `mem://architecture/cache-governance`).

### 3.2 10 mil pacientes
- Busca de paciente já tem fallback server-side (`getPacientes()` +
  `getPacienteByCPF`). Risco: o dropdown de paciente parece operar sobre
  `getPacientes()` local — escalabilidade depende de paginação no store
  (`usePaginatedPacientes` existe, mas a página não a usa diretamente).

### 3.3 100 mil atendimentos
- ✅ `fetchAtendimentoByProtocolo` server-side cobre o caso de cache vazio
  em edição.
- ⚠️ `getAtendimentos()` é consultado em `:384` antes do fallback —
  pressupõe que o cache global suporte volume. Em larga escala, o
  `addAtendimento` que faz invalidação/inserção otimista pode crescer em
  memória.
- ⚠️ Sem paginação nesta página (não é problema próprio dela; é da
  store).

### 3.4 Concorrência
- Múltiplos atendentes salvando simultaneamente: protegido pela RPC
  transacional (BEGIN/COMMIT) e por unicidade de protocolo
  (`getNextProtocolo` server-side). Risco residual: `getNextProtocolo`
  deve ser atômico no banco (a função existe em `protocolo_sequence`).

### 3.5 RBAC server-side
- ✅ `requiredPermissionForUpdate` cobre cancelar/pagar/editar. Frontend
  é apenas UX.

## 4. Riscos funcionais não cobertos por validação

- **Convênio default `"Particular"`**: forçado em vários pontos. Se o
  cadastro do tenant remover Particular, o código ainda assume sua
  existência (linhas 208–210, 224, 568).
- **`SEM SOLICITANTE` mágico**: string hard-coded para fluxo web (`:210`).
  Não há constante centralizada.
- **`__ambos` sentinel**: string mágica em vários lugares (`:465`, `:543`,
  `:582`, `:766`). Sem enum.
- **Distribuição de desconto** (`:490–513`) é unilateral (paciente). Se
  no futuro algum convênio aceitar desconto, regra silenciosa quebra.

## 5. Severidade consolidada

| Risco | Probabilidade | Impacto | Severidade |
|---|---|---|---|
| Monólito 2.598 linhas | Alta | Alto | **CRÍTICO** |
| Duplicação de preço (4×) | Alta | Alto | **ALTO** |
| Estado disperso (38 useState) | Alta | Médio | **ALTO** |
| Strings mágicas (Particular/SEM SOLICITANTE/__ambos) | Média | Médio | **MÉDIO** |
| Hidratação por sinal em edit | Baixa | Médio | **MÉDIO** |
| Sem virtualização em catálogos grandes | Baixa hoje | Médio | **MÉDIO** (latente) |
| Concorrência / atomicidade | Baixa | Alto | **BAIXO** (coberto por RPC) |
| Isolamento multi-tenant | Baixa | Crítico | **BAIXO** (coberto por RLS) |
