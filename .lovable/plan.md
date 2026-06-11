## Architectural Split Program — Plano de execução faseado

### Tamanho atual confirmado
- `ResultadoDetalhe.tsx` — 2.627 linhas
- `NovoAtendimento.tsx` — 2.570 linhas
- `Financeiro.tsx` — 2.413 linhas
- `atendimentoStore.ts` — 1.504 linhas
- **Total:** 9.114 linhas a reorganizar (sem alterar comportamento)

### Por que faseado, com confirmação entre fases
A missão exige `mesmo input = mesmo output` em 4 módulos clínicos/financeiros críticos. Tentar executar Fases 1–7 num único turno significaria mover ~9k linhas em paralelo, sem você poder validar regressão a cada etapa. A memória do projeto também impõe que mudanças estruturais (rotas, contextos globais, boot) só ocorram com confirmação explícita. Proposta: **uma fase por turno**, com diff pequeno, checkpoint de smoke test, e só então a próxima.

### Estratégia comum (todas as fases)
1. **Extração mecânica primeiro** — recortar trechos contíguos para novos arquivos, manter assinaturas e imports. Sem renomear funções, sem alterar fluxo de dados, sem refatorar lógica interna.
2. **Re-export shim quando útil** — manter caminho legado importável durante a transição (zero risco para consumidores externos).
3. **API pública intocada** — hooks, stores e páginas continuam sendo importados pelo mesmo path original (`@/pages/...`, `@/data/atendimentoStore`).
4. **Sem novas dependências, sem mudar tipos públicos, sem mudar RPC/edge/RLS.**
5. **Validação por fase:** `tsc` limpo + smoke manual no fluxo da fase + diff revisado.

### Ordem proposta (menor risco → maior risco)

```text
Fase 4  →  atendimentoStore split        (1.504 linhas, base de tudo)
Fase 3  →  Financeiro split              (2.413 linhas, leitura-mostly)
Fase 1  →  ResultadoDetalhe split        (2.627 linhas, PDF/assinatura)
Fase 2  →  NovoAtendimento split         (2.570 linhas, wizard + preço)
Fase 5  →  Services consolidation        (após arquivos divididos)
Fase 6  →  Regressão guiada              (checklist por módulo)
Fase 7  →  Relatórios em docs/refactors/
```

Inverti a ordem original (4→3→1→2) porque:
- `atendimentoStore` é dependência de `ResultadoDetalhe` e `NovoAtendimento`; quebrá-lo depois força retrabalho.
- `Financeiro` é o mais isolado (read-only via store) — ótimo "ensaio" do padrão antes dos módulos críticos.

### Detalhamento por fase

**Fase 4 — `src/data/atendimentoStore/`**
Split mecânico em `types.ts`, `queries.ts`, `mutations.ts`, `realtime.ts`, `status.ts`, `payments.ts`, `selectors.ts`, `index.ts` (apenas reexporta). Arquivo legado `atendimentoStore.ts` vira shim de 1 linha re-exportando do diretório. **Zero mudança nos imports das telas.**

**Fase 3 — `src/pages/Financeiro/`**
Já existem `helpers.ts` e `types.ts`. Adicionar `components/FinanceiroKpis|Entradas|Saidas|Faturas|Filtros.tsx`, `hooks/useFinanceiro.ts` (estado + queries derivadas), `services/FinanceiroService.ts` (agregações puras). `index.tsx` vira orquestrador (<400 linhas).

**Fase 1 — `src/pages/ResultadoDetalhe/`**
Já existem `helpers.ts`, `types.ts`, `ParamTypedInput.tsx`. Adicionar `components/Resultado{Header,Actions,Parametros,Assinaturas,Anexos,PdfPanel}.tsx`, `hooks/useResultadoDetalhe.ts`, `services/ResultadoDetalheService.ts`. Mover `calcStatusGeral` duplicado, `isExameLiberado`, `addAuditEntry`, `handleLiberarTodos` etc. para o service. `index.tsx` <500 linhas.

**Fase 2 — `src/pages/NovoAtendimento/`**
Já existem `helpers.ts`, `types.ts`, `pricing.ts`, `buildExamesCobranca.ts`. Adicionar `steps/{Paciente,Exames,Pagamento,Confirmacao}Step.tsx`, `hooks/useNovoAtendimento.ts` (estado do wizard), `services/AppointmentWizardService.ts` (orquestração + validações puras). `index.tsx` <400 linhas.

**Fase 5 — Services first**
Consolidar 4 services criados acima; remover duplicações remanescentes apontadas em `ssot-validation.md` (ex.: `calcStatusGeral` vs `deriveStatusGeral`, `parseNum` vs `parseNumeric`, `escapeHtml` triplicado). Apenas remover duplicação — nenhuma nova regra.

**Fase 6 — Regressão**
Checklist manual + os testes Vitest existentes (`pricing.test.ts`, `buildExamesCobranca.test.ts`). Não vou inventar novos testes a menos que você peça.

**Fase 7 — Relatórios**
Gerar os 5 arquivos em `docs/refactors/` com tabela antes/depois (linhas, responsabilidades, módulos) e confirmação textual de cada "alterado? NÃO".

### O que NÃO farei (respeitando as suas constraints)
- Não tocar regras clínicas, financeiras, status, assinaturas, liberação, RLS, edge functions, banco.
- Não criar abstrações genéricas (`BaseService`, etc.).
- Não fazer "melhorias de oportunidade" durante o split.
- Não alterar a dashboard do tenant nem reintroduzir PWA.
- Não alterar `src/integrations/supabase/client.ts` nem auto-gen.

### Próximo passo
Confirme a ordem (4 → 3 → 1 → 2 → 5 → 6 → 7) e eu começo pela **Fase 4 (atendimentoStore)** no próximo turno, entregando apenas ela para você validar antes de seguir. Se preferir a ordem original do briefing (1 → 2 → 3 → 4), também sigo — só registre.