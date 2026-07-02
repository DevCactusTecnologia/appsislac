# 11 — Dead Code Evidence

**Regra da fase**: NÃO afirmar que existe código morto. Apenas registrar evidências objetivas quando presentes, ou declarar "NÃO É POSSÍVEL AFIRMAR".

## Metodologia

- Auditoria estrutural (leitura de nomes, coexistências, arquivos irmãos).
- Nenhuma análise de AST/tree-shaking foi executada nesta fase.
- Nenhuma alteração de arquivo foi feita.

## Candidatos com sinais estruturais (sem afirmação de morte)

| Arquivo | Sinal | Conclusão |
| ------- | ----- | --------- |
| `next.config.js` (raiz) | Stack declarado é Vite (`vite.config.ts` presente e ativo). Arquivo `next.config.js` não corresponde ao framework em uso. | NÃO É POSSÍVEL AFIRMAR sem verificar uso por hosting/build externos. |
| `src/pages/LandingPageResponsive.tsx` | Coexiste com `src/pages/Landing.tsx`. Nomes sugerem duas versões da landing. | NÃO É POSSÍVEL AFIRMAR sem inspecionar `App.tsx` para verificar qual rota está ativa. |
| `src/pages/Index.tsx` | Coexiste com `Landing.tsx` e `Dashboard.tsx`. Nome genérico pode indicar redirecionador. | NÃO É POSSÍVEL AFIRMAR. |
| `src/components/AtendimentoDetalheDialog.tsx` vs `src/components/atendimento/FerramentasAvancadasMenu.tsx` | Diretório `atendimento/` existe com 1 arquivo enquanto vários dialogs de atendimento estão na raiz. | Sem sinal de código morto; possível oportunidade de reorganização (fora do escopo). |
| Diretórios `src/components/{atendimento,auditoria,assistente,seo,usuarios}/` com apenas 1 arquivo | Baixa densidade | Sem sinal de código morto. |
| `public/llms.txt` | Arquivo estático informativo; sem consumidor de código | Comportamento esperado (metadata pública). |
| `supabase/tests/update_atendimento_tx_preserves_state.sql` | Único teste SQL. | Sem sinal de morte — teste válido. |

## Arquivos sem import direto (evidência insuficiente)

Nenhum arquivo do domínio ativo foi identificado com evidência forte de ausência de import. Uma varredura completa exigiria:

- Análise ATS por arquivo (`import` explícitos + `import()` dinâmicos + tipos-only + string-based `Route element={<X/>}`).
- Inspeção do bundler para dead-code elimination.

Como a fase proíbe tal invasão, todos os candidatos permanecem classificados como:

> **NÃO É POSSÍVEL AFIRMAR.**

## Duplicidade estrutural (ver relatório específico)

- `src/domains/appointment/services/pricing.ts` **e** `src/lib/pricing/pricingEngine.ts` — ambos existem. Pode indicar migração parcial. NÃO É POSSÍVEL AFIRMAR se um substituiu o outro.
- Vários guias de migração/compliance na raiz do repo (`GUIA-*.md`, `LGPD_RDC_MIGRACAO_AUTOMATICA.md`) e em `docs/*` sobrepõem-se parcialmente. Documentação, não código.

## Conclusão

O projeto NÃO apresenta evidência objetiva de código morto passível de afirmação sob esta metodologia. Todos os candidatos são "sinais" a serem investigados em fases posteriores que permitam análise dinâmica.
