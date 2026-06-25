## Redesign — Valores de Referência (modelo "Padrão + Variações")

Aplicar a proposta do documento anexado: trocar a interface atual (Matriz + Régua etária + Sexo) por **um card "Padrão" + cards de "Variações por categoria"**, com lógica de prioridade clara.

Mudança estrutural — precisa de aprovação explícita antes de executar (regra do projeto).

---

### O que vai mudar — visão do usuário

Para cada parâmetro do exame:

```text
┌─ PADRÃO (todos os pacientes) ───────────────┐
│ Normal:   [min] – [max]  unid.              │
│ Crítico:  [min] – [max]  unid.              │
└─────────────────────────────────────────────┘

[+ Adicionar variação]   → Gestante · Criança · Adolescente · Idoso · Recém-nascido · Masculino · Feminino · Personalizada

┌─ 🤰 GESTANTE ──────────────────────── 🗑 ───┐
│ Normal:   [min] – [max]                     │
│ Crítico:  [min] – [max]                     │
└─────────────────────────────────────────────┘
```

Cada card mostra um preview ("12.5 g/dL → NORMAL", "8.0 g/dL → CRÍTICO") com os próprios valores.

---

### Lógica de aplicação (resolver)

Prioridade na hora de validar resultado:

1. **Situação clínica** (gestante) — se marcada no atendimento
2. **Categoria etária** (Recém-nascido <28d, Criança 1–12a, Adolescente 13–18a, Adulto 19–64a, Idoso 65+)
3. **Sexo** (Masculino/Feminino) — só se variação por sexo existir
4. **Padrão** — fallback final

Primeira categoria que tem VR cadastrado vence. Mantém compatível com `criticoChecker` e `##REF_X##`/`##FLAG_X##` no laudo.

---

### Mudanças técnicas (resumo)

**Banco** (`valores_referencia`):
- Adiciona coluna `categoria text` (enum check: `padrao`, `gestante`, `recem_nascido`, `crianca`, `adolescente`, `adulto`, `idoso`, `masculino`, `feminino`, `custom`).
- Adiciona `prioridade int` (calculado server-side a partir da categoria, usado para ordenar).
- `idade_min_dias`/`idade_max_dias` continuam — preenchidos automaticamente pela categoria.
- Backfill: linhas existentes viram `categoria='custom'` preservando faixa etária + sexo atuais (zero perda).
- GRANTs + RLS preservados.

**Stores / lógica**:
- `valoresReferenciaStore`: novo campo `categoria`; helper `resolverPorCategoria(parametroId, paciente)` substitui o resolver por sexo+idade (mantém shim).
- `criticoChecker` / `parseValorReferencia` / `laudoResolver` passam pelo novo resolver.

**UI**:
- Novo `ValoresReferenciaPanel.tsx` (card Padrão + cards de variação + botão "+ Adicionar variação" com menu de categorias).
- `EditarValorReferenciaDialog.tsx`: modal único com Normal Min/Max, Crítico Min/Max, unidade, preview ao vivo.
- `DetalhesExameDialog` / `FiltrosDialog`: substituem a Matriz atual pelo novo painel. "Avançado" (lista crua + faixa etária custom) fica colapsável para casos exóticos.
- `MatrizValoresReferencia.tsx` vira o modo Avançado.

**Régua etária**:
- Continua existindo, mas só aparece dentro do modo Avançado / categoria "Personalizada". Deixa de ser o caminho principal.

---

### Ordem de execução

```text
M1  add valores_referencia.categoria + check + index
M2  backfill (linhas atuais → categoria='custom' com faixa preservada)
M3  novo painel + dialog + integração em DetalhesExameDialog
M4  novo resolver + adaptar criticoChecker / laudoResolver
M5  modo Avançado (esconder matriz atrás de toggle)
M6  smoke test: criar VR padrão → digitar resultado → conferir crítico → imprimir laudo
M7  docs/valores-referencia-2.0/phase3-redesign-report.md
```

Nenhuma coluna é dropada nesta fase — tudo aditivo e reversível. Drop só em fase posterior, depois de validação real.

---

### Riscos / decisões em aberto

- Categoria "Gestante" depende de marcar gestação no atendimento. Hoje existe esse dado? Se não, vira flag manual no resultado (preciso confirmar antes de M3).
- Categoria "Criança/Idoso" usa faixas fixas (1–12a, 65+) — usuário pode customizar via "Personalizada".
- Mantém a régua etária como recurso avançado para não perder os usuários que já usam Sysmex/Lareval.

---

**Confirma o redesign nesses termos para eu disparar M1?** Ou quer ajustar categorias / faixas antes?
