# FASE 3 — Single Source of Truth Audit

## Inventário de geradores/derivadores

| Família | SSOT atual | Classificação |
|---|---|---|
| `calculatePrice*` / precificação | `src/domains/appointment/services/pricing.ts` | **SSOT preservado** |
| `buildComprovanteHtml` / `buildOrcamentoHtml` | `src/domains/result/services/comprovantesHtml.ts` (única) | **SSOT preservado** |
| `renderAndSave` (PDF) | `comprovantesRender.ts` | **SSOT preservado** |
| `deriveStatus` atendimento | `src/lib/atendimentoStatus.ts` | **SSOT preservado** |
| `criticoChecker` | `src/domains/result/services/criticoChecker.ts` (re-export de `src/lib/criticoChecker.ts`) | **SSOT parcial** — fachada legada ainda exporta; sem divergência funcional, mas dois caminhos de import |
| `parseValorReferencia` | `src/domains/result/services/parseValorReferencia.ts` + `src/lib/parseValorReferencia.ts` | **SSOT parcial** — mesma função em duas localizações; verificar se ambos são o mesmo módulo (re-export) |
| Dicionários (`select_options`) | `useDicionario` (read) + `selectOptionsStore` (write/admin) | **SSOT preservado** — `useSelectOptions` marcado `@deprecated` |
| Dicionários financeiros (tipo despesa, destino, forma pgto) | `useDicionario` + invalidação após mutação | **SSOT preservado** |
| Layouts/impressão de laudo | `laudoLayout.ts` + `laudoResolver.ts` + `laudoTemplate.ts` | **SSOT preservado** (e congelado) |
| `documentoRenderer.ts` vs `comprovantesHtml.ts` | Coexistem | **SSOT parcial** — pendência documentada anteriormente (convergir builders) |
| `validate*` paciente / CPF | `src/lib/cpf.ts` + `src/domains/patient/validators` | **SSOT preservado** |
| `send*` WhatsApp | edge `whatsapp-send` único | **SSOT preservado** |
| `release*` resultado | `atendimentoStore.liberar*` + `atendimentoStatus` | **SSOT preservado** |

## Duplicações remanescentes (não-bloqueantes)

1. **`parseValorReferencia` / `criticoChecker`** em `src/lib/` e `src/domains/result/services/`. Se um lado for re-export do outro: aceitável. Se forem cópias: risco baixo, mas a próxima rodada de slicing deve consolidar.
2. **`documentoRenderer.ts` ↔ `comprovantesHtml.ts`** — convergência já identificada como próximo passo recomendado.
3. **`selectOptionsStore` ↔ `useDicionario`** — coexistência intencional (CRUD admin vs leitura React Query). Não é divergência de fonte da verdade.

**Veredito:** SSOT majoritariamente **preservado**. Dois pontos parciais sem impacto funcional, ambos já mapeados como próximos slicings.
