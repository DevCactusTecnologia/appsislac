## Fase 2A — Split Arquitetural de NovoAtendimento.tsx

### Diagnóstico atual

`src/pages/NovoAtendimento.tsx` — **2.801 linhas**, **1 componente**, ~**80 useState**, ~**15 useEffect**, função `finalizarAtendimento` de ~200 linhas, mais ~1.700 linhas de JSX no return final (wizard de 3+ passos com painéis colapsáveis).

Já existem em `src/pages/NovoAtendimento/`:
- `types.ts`, `helpers.ts`, `pricing.ts`, `buildExamesCobranca.ts`
- `services/distribuirDesconto.ts`, `services/contarEtiquetas.ts`, `services/resyncCobrancaConvenios.ts`
- `DropdownStatus.tsx`, `highlightMatch.tsx`
- testes verdes: `pricing.test.ts`, `buildExamesCobranca.test.ts`

Ou seja, a camada de **services** já está extraída. O que resta é o **split de UI + hooks**.

---

### Por que estou pedindo confirmação antes de executar

A memória do projeto exige:
> *Mudanças estruturais (rotas, remoção/renomeação de páginas, boot, deps, contextos globais) SÓ com confirmação explícita do usuário.*

Refatorar um arquivo de 2.801 linhas com ~80 estados intertravados em 6 sections + 3 hooks é uma das mudanças estruturais mais sensíveis do sistema. Um único `useState` movido errado quebra finalização, edição, complementação, cancelamento ou estorno. **A missão exige "0 diferença perceptível" — isso só é validável com o usuário rodando smoke test real.**

Por isso quero alinhar a estratégia antes de tocar 2.800 linhas.

---

### Estratégia proposta — split em 4 sub-turnos sequenciais

Cada sub-turno é independente, com build verde e smoke test antes do próximo. Total ~ mesmo escopo da missão, porém com pontos de validação intermediários.

```text
Turno A.1 — Hooks (sem tocar JSX)
  hooks/useAtendimentoForm.ts        (estado de paciente/convênio/solicitante/unidade/data/observações)
  hooks/useExamesSelecionados.ts     (exames + cobrança + desconto/acréscimo + pagamentos)
  hooks/useFinalizarAtendimento.ts   (finalizarAtendimento + finalizarComValidacao + edge function)
  NovoAtendimento.tsx consome os hooks; JSX inalterado.
  → ~600 linhas saem para hooks.

Turno A.2 — Sections "leves" (header do wizard)
  sections/PacienteSection.tsx       (busca, dropdown, dialog cadastro, débitos)
  sections/SolicitanteSection.tsx    (solicitante, unidade, datas, info clínica)
  sections/ConveniosSection.tsx      (convênios + sincronização cobrança)
  → ~600 linhas saem.

Turno A.3 — Sections "pesadas"
  sections/ExamesSection.tsx         (catálogo, busca, inclusão, agrupamento, IA)
  sections/FinanceiroSection.tsx     (cobrança, desconto, acréscimo, pagamentos)
  sections/ResumoSection.tsx         (revisão, impressão, sucesso, orçamento)
  → ~1.300 linhas saem.

Turno A.4 — Limpeza + relatório
  Remover imports/consts/tipos mortos.
  docs/atendimento-2.0/atendimento-phase2a-report.md
```

Resultado final esperado: `NovoAtendimento.tsx` ≈ **300–500 linhas**, atuando apenas como orquestrador.

---

### Garantias mantidas em todos os turnos

- **0 alteração** de: rota, RPC, edge function, store global, RLS, trigger, banco, contrato visual, contrato de teclado, IDs de elementos.
- **Props drilling explícito** entre sections e hooks — proibido criar contexto novo, store novo ou padrão novo (como pede a missão).
- Testes obrigatórios verdes a cada turno: `bun run build` + `bunx vitest run pricing.test.ts buildExamesCobranca.test.ts`.
- Após cada turno, paro e peço smoke test (Particular, Convênio, Desconto, Acréscimo, Pagamento, Impressão, Complementação, Cancelamento, Estorno).

---

### O que preciso confirmar antes de começar

1. **Aprovo executar Turno A.1 (hooks) agora?** Esse é o turno de menor risco e já entrega ~600 linhas movidas.
2. **Concorda com fatiar em 4 sub-turnos?** Alternativa é tentar tudo num só turno, mas aceito o risco de regressão silenciosa em fluxos clínicos.
3. **Smoke test será feito por você** após cada turno, ou devo prosseguir entre turnos sem aguardar resposta?

Sem essas respostas não toco no arquivo, conforme a regra de confirmação explícita para mudanças estruturais.
