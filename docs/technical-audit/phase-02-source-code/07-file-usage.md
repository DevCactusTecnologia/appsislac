# 07 — File Usage

Classificação de uso por evidência de import + referência funcional.

## Frequência

| Nível | Definição | Exemplos |
| ----- | --------- | -------- |
| Frequente | Referenciado em dezenas ou centenas de arquivos | `components/ui/*` (button, dialog, input, table, select, badge, card, tooltip, sonner), `runtime/db.ts`, `lib/utils.ts`, `lib/queryClient.ts`, `contexts/AuthContext.tsx`, `data/atendimentoStore/index.ts`, `data/pacienteStore.ts` |
| Recorrente | Referenciado em várias páginas ou stores (≥5) | `lib/dateBR.ts`, `lib/idade*.ts`, `lib/masks.ts`, `lib/validation.ts`, `lib/logger.ts`, `lib/ttlCache.ts`, `lib/printHtml.ts`, `lib/sanitizeHtml.ts`, `components/StatusBadge.tsx`, `components/AtendimentoDetalheDialog.tsx` |
| Pontual | Referenciado em 1–4 arquivos | Componentes específicos de uma tela (ex.: `components/configuracoes/GerenciarReguasDialog.tsx`, `components/estoque/LoteDialog.tsx`), hooks especializados (`useHidScanner.ts`) |
| Sem evidência suficiente | Não é possível afirmar utilização apenas por leitura estrutural | Ver `11-dead-code-evidence.md` |

## Notas

- **Cada rota** em `src/pages/**` tem exatamente um consumidor: o roteador em `App.tsx`. Individualmente pontuais, mas coletivamente essenciais.
- **`src/integrations/providers/registry.ts`**: uso pontual (single import), porém indispensável para bootstrap.
- **`src/lib/confetti.ts`, `src/lib/celebracao*` (via `CelebracaoLiberacaoDialog.tsx`)**: uso pontual — trigger de UX específico ao liberar laudos.
- **Edge functions**: cada uma tem consumidor único e específico (frontend HTTP call). Uso é pontual por função mas frequente para as centrais (`create-atendimento`, `update-atendimento`, `sign-resultado`, `integration-dispatch`).
- **Migrations**: consumidas exclusivamente pela CLI/pipeline Supabase.
- **Scripts**: consumidos por CI ou por operadores humanos.

## Arquivos com nenhum uso observável em runtime

Marcados aqui como "sem evidência suficiente" (não como "sem uso"), porque a evidência de ausência requer análise completa de ASTs — fora do escopo desta fase:

- `next.config.js` — presente na raiz apesar do stack ser Vite. Sem evidência de que Next seja utilizado.
- `public/llms.txt` — arquivo estático informativo; sem consumidor de código.
- `src/pages/LandingPageResponsive.tsx` — coexiste com `Landing.tsx`. Consulte relatório de duplicidade.

## Observação

Este relatório NÃO afirma que qualquer arquivo é código morto. Ver `11-dead-code-evidence.md` para tratamento formal.
