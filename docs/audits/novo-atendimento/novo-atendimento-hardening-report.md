# /novo-atendimento — Hardening Report

> Missão preventiva: consolidar fontes únicas de verdade, remover código
> morto e proteger as regras com testes. **Nenhuma regra de negócio,
> fluxo, UX, RPC, edge function, RLS ou RBAC foi alterada.**

---

## Escopo executado

| Fase | Ação | Status |
|---|---|---|
| 1 | Consolidação do cálculo de preço | ✅ |
| 2 | Consolidação do payload `examesCobranca` | ✅ |
| 3 | Remoção do código morto `examesCatalogoLegado` | ✅ |
| 4 | Esclarecimento do uso de `editAtendimentoData` (sem mudança comportamental) | ✅ |
| 5 | Testes de proteção contra regressão | ✅ |
| 6 | Documentação de governança | ✅ |

---

## Antes

| Métrica | Quantidade |
|---|---|
| Reimplementações do fallback de preço (`getPrecoExame ?? ?? 0`) | **4** sítios em `NovoAtendimento.tsx` (linhas 159, 424, 455, 650) |
| Construções inline do payload `examesCobranca` | **2** sítios idênticos (linhas 532–546 e 571–585) — 14 linhas cada |
| Símbolos legados importados sem uso | **1** (`examesCatalogoLegado`) |
| Comentário enganoso sobre re-render artificial | **1** bloco (linhas 389–391) |
| Testes cobrindo preço/payload deste fluxo | **0** |
| Documento de governança da página | **0** |

---

## Depois

| Métrica | Quantidade |
|---|---|
| Reimplementações do fallback de preço | **0** — todas chamam `calculateExamPrice()` |
| Construções inline do payload `examesCobranca` | **0** — ambas chamam `buildExamesCobranca()` |
| Símbolos legados importados sem uso | **0** |
| Comentário enganoso | reescrito (sem alterar comportamento) |
| Testes cobrindo preço/payload | **17** (7 em `pricing.test.ts`, 10 em `buildExamesCobranca.test.ts`) |
| Documento de governança | `docs/governance/novo-atendimento-rules.md` |

---

## Fontes únicas de verdade criadas

| Conceito | Arquivo | Função |
|---|---|---|
| Preço de exame | `src/pages/NovoAtendimento/pricing.ts` | `calculateExamPrice` |
| Payload de cobrança | `src/pages/NovoAtendimento/buildExamesCobranca.ts` | `buildExamesCobranca` |

---

## Fase 4 — `editAtendimentoData`

Mapeamento realizado:

- **Quem altera**: 2 sítios (effect de hidratação em modo edição, linha
  ~415; fallback server-side para atendimento fora do cache, linha ~393).
- **Quem consome**: `finalizarAtendimento` em modo edição (linhas
  525–527), como fallback de `cpf`/`nascimento`/`idade` quando o paciente
  não está em `getPacientes()`.
- **Render que depende**: nenhum render JSX depende diretamente desse
  estado — ele é apenas um buffer de dados.

**Veredito**: o comentário antigo classificava o `setState` do fallback
como "sinal de re-render", o que é **incorreto** — o dado é realmente
consumido downstream. **Não há anti-pattern real**, apenas documentação
enganosa. Comentário reescrito; nenhuma estrutura alterada (não vale a
pena introduzir `useMemo`/refs para um buffer que já funciona e não causa
render extra).

---

## Risco residual

**Classificação: BAIXO.**

| Risco | Mitigação |
|---|---|
| Alguém reimplementar fallback de preço inline | Teste `pricing.test.ts` + regra no doc de governança |
| Alguém alterar default do payload | Teste `buildExamesCobranca.test.ts` cobre 10 cenários (defaults, override, sentinel, multi-solicitantes) |
| Reintrodução de `examesCatalogoLegado` | Importação removida; doc de governança proíbe explicitamente |
| Tamanho do arquivo (~2.569 linhas) | **Não tratado** — fora do escopo (auditoria explicitamente vetou refatoração estrutural) |

---

## Impacto observável

- **Para o usuário final**: zero. Mesma UX, mesmo fluxo, mesmos preços,
  mesmos dados persistidos.
- **Para o desenvolvedor**: 1 ponto de mudança por regra (antes: 4 para
  preço, 2 para payload). Quebra de regra = teste vermelho.
- **Linhas líquidas no arquivo principal**: `NovoAtendimento.tsx`
  reduziu de **2.598 → 2.569** (-29 linhas), mas redução **não era o
  objetivo**.

---

## Critério de parada

Atingido. Sem refatoração arquitetural, sem novas stores, sem novo
contexto, sem alteração de wizard/RPC/edge/DB/RLS/RBAC.
