## Plano — Padronização Definitiva dos Documentos Operacionais

Mapeamento concluído (read-only). Antes de executar quero alinhamento sobre escopo exato, porque algumas remoções tocam arquivos congelados por constraint.

---

### Fase 1 — `escapeHtml` único

Manter `@/lib/escapeHtml.ts` como SSOT. Remover cópias locais e migrar imports em:

- `src/lib/dossieRastreabilidade.ts` (linha 21)
- `src/lib/etiquetaAmostra.ts` (linha 27) ⚠️ memória diz "não tocar etiquetas" — vou apenas trocar a função local pelo import, sem mexer no HTML/lógica.
- `src/lib/mapaPrint.ts` (linha 64) ⚠️ memória diz "não tocar Mapa de Trabalho" — idem, só import.
- `src/data/auditLogsStore.ts` (linha 336)
- `src/lib/regulatorioResolver.ts` (linha 77)
- `src/lib/laudoTemplate.ts` (linha 89) ⚠️ laudo congelado — **não mexer**, manter local.
- `src/lib/lgpdReport.ts` (usa `esc` inline — substituir por import)
- `src/lib/documentoRenderer.ts` (verificar)

> Pergunta: posso trocar a *função local* por import nos arquivos congelados (etiqueta, mapa) já que comportamento é idêntico? Ou prefere preservá-los intactos e consolidar só os não-congelados?

### Fase 2 — `formatDateBR` único

Criar `src/lib/dateBR.ts` com `formatDateBR(iso)` e `formatDateNow()`. Migrar:

- `src/data/financeiroStore.ts`
- `src/data/pacienteStore.ts`
- `src/data/orcamentoStore.ts`
- `src/data/atendimentoStore/_internal.ts` (export atual — ajustar barril)
- `src/lib/mapaPrint.ts` (variante sem args)

### Fase 3 — Shell A4 (`src/lib/printShell.ts`)

```ts
wrapA4Document({ title, bodyHtml, orientation?, margin?, css? }): string
```

Aplicar **apenas** em:
- `lgpdReport.ts`
- `auditLogsStore.ts` (relatório auditoria)
- `dossieRastreabilidade.ts`
- relatórios admin de Tabelas/Catálogo/Produção (se inline)

**Não** aplicar em: comprovantes (já têm `buildEmitenteHeader`), laudo, mapa, etiqueta, orçamento.

### Fase 4 — `buildAdminReportHeader()`

Em `src/lib/comprovantes.ts` (ou novo `adminReportHeader.ts`) usando `getLabConfig()`. Aplicar em LGPD, Auditoria, Produção, Catálogo, Tabelas, Dossiê, Detalhe Entrada.

> Pergunta: header admin deve seguir Lovable Minimalist (preto/branco) ou paleta admin atual `#1e3a8a`? Memória de identidade visual sugere o primeiro.

### Fase 5 — Aliases triviais e `<script>print()</script>` redundante

- `buildOrcamentoHtmlPublic` → 4 callers. Substituir por `buildOrcamentoHtml` direto e remover alias em `comprovantes.ts` e `comprovantesHtml.ts`.
- Remover `<script>window.print()</script>` inline em `lgpdReport.ts`, `auditLogsStore.ts`, `ConvenioExamesPanel.tsx`, `ResultadoDetalhe.tsx`, `LaudoPrintPage.tsx` — **somente quando** já passam por `printHtmlInHiddenFrame`.

> ⚠️ `LaudoPrintPage.tsx` é a página dedicada de laudo (rota standalone). Ela usa `window.print()` direto, não iframe. **Não vou tocar** — laudo congelado.

### Fase 6 — Código morto

Após fases 1-5, varrer com `knip`/`ts-prune` mental:
- exports sem consumidores em `comprovantes.ts`, `comprovantesHtml.ts`
- helpers órfãos pós-consolidação

Só remover com 0 referências em `rg`.

### Fase 7 — Não tocar (lock list)

Laudo (`buildLaudoHtml`, `laudoHtmlBuilder`, `LaudoPrintPage`, `ResultadoDetalhe` impressão), CKEditor, `documento_templates`, `html2pdf` do orçamento, Mapa (CSS próprio), Etiquetas, RLS, multi-tenancy.

### Fase 8 — Validação

Smoke manual via build + leitura. Sem testes E2E novos.

### Fase 9 — Relatório

`docs/documentos/document-standardization-final-report.md` respondendo as 10 perguntas.

---

### Confirmações pedidas antes de começar

1. **OK trocar a função `escapeHtml` local por import nos arquivos congelados (mapa, etiqueta)?** (mesmo comportamento, só DRY)
2. **Header admin: Lovable Minimalist (P&B) ou manter `#1e3a8a` atual?**
3. **OK manter `LaudoPrintPage.tsx` intocado** (continua com `window.print()` próprio)?
4. **Posso executar tudo em uma rodada** ou prefere fase a fase com revisão entre elas?

Confirme e eu executo. Sem confirmação, paro aqui (constraint de mudanças estruturais).