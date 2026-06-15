# ResultadoDetalhe V2 — Proposta Operacional (apenas prototipação)

**Data:** 2026-06-15
**Status:** Proposta — **nenhum código alterado**.
**Escopo:** classificar elementos da tela atual em Essencial / Secundário /
Avançado e propor reorganização em 4 abas, **sem** tocar em CSS de impressão,
geração de PDF, autosave, validações clínicas, stores ou rotas.

> Constraint respeitada: `mem://constraints/layout-impressao-travado`
> (margens, rodapé 4mm, assinatura e CSS @print de `ResultadoDetalhe.tsx`
> permanecem congelados).

---

## 1. Inventário da tela atual (`src/pages/ResultadoDetalhe.tsx`)

Tudo aparece hoje em uma única dobra densa:

| Bloco | Onde está | Frequência de uso real (estimada) |
|---|---|---|
| Identificação do paciente (nome, idade, sexo, protocolo) | header | 100% |
| Lista de exames do atendimento com status colorido | coluna esquerda | 100% |
| Painel de parâmetros do exame selecionado | corpo central | 95% |
| Campo de digitação de resultado por parâmetro | corpo central | 95% |
| Indicador de "valor crítico" inline | corpo central | 60% |
| Referências clínicas (faixas etárias/sexo) | abaixo de cada parâmetro | 40% |
| Botão Salvar + Liberar (ação primária) | rodapé fixo | 100% |
| Anexos (contador + abrir) | barra lateral | 25% |
| Histórico de retificações (timeline) | barra lateral | 10% |
| Assinatura digital do laudo | rodapé | 100% no momento da liberação |
| Botão "Imprimir / Gerar PDF" | header | 70% |
| Auditoria detalhada (quem alterou o quê) | menu | 5% |
| Cancelar liberação | menu | <2% |
| Retificar com diff | menu | <5% |
| Trocar analista responsável | menu | <5% |
| Modo `?modoConsulta` (somente leitura) | header | 30% |

---

## 2. Classificação Essencial / Secundário / Avançado

### Essencial — sempre visível na 1ª dobra (>90% dos acessos)
- Identificação do paciente + protocolo + idade + sexo.
- Lista de exames do atendimento com status.
- Painel de parâmetros + campo de resultado do exame selecionado.
- Indicador inline de valor crítico.
- Botão **Salvar + Liberar**.
- Botão **Imprimir / Gerar PDF** (preserva handler atual).

### Secundário — a 1 clique (accordion/aba dedicada)
- Referências clínicas detalhadas por parâmetro.
- Anexos (lista, upload, download).
- Histórico de movimentações / timeline de retificações.
- Assinatura digital (rodapé fixo na aba Impressão).

### Avançado — a 2 cliques (menu/dialog)
- Auditoria detalhada.
- Cancelar liberação.
- Retificar com diff.
- Exportar PDF customizado.
- Trocar analista responsável.

---

## 3. Estrutura proposta (4 abas)

```text
┌────────────────────────────────────────────────────────────────┐
│ Paciente: Maria Silva  ·  42a  ·  F  ·  Protocolo #2026-00481 │
│ [ Resultado ]  [ Histórico ]  [ Anexos ]  [ Impressão ]       │
└────────────────────────────────────────────────────────────────┘
```

### Aba [ Resultado ] — default (90% dos acessos)
```text
┌─────────────────────┬──────────────────────────────────────────┐
│ Exames do atendim.  │ Hemograma completo                       │
│ ● Hemograma  pend.  │ ─────────────────────────────────────── │
│ ○ Glicemia   ok     │ Hemácias  [ 4,8 ] x10^6/µL    REF: 4–5  │
│ ○ TSH        ok     │ Hemoglob. [ 14,2 ] g/dL       REF: 12–16│
│                     │ Leucócitos [ 7 500 ] /µL  ⚠ valor crít. │
│                     │ ...                                      │
│                     │                                          │
│                     │           [ Salvar ]   [ Liberar ]       │
└─────────────────────┴──────────────────────────────────────────┘
```
Conteúdo idêntico ao atual; apenas o que **não** é Essencial sai daqui.

### Aba [ Histórico ]
- Timeline de movimentações (criado, em análise, retificado, liberado…).
- Diff de retificações (mantém componente atual; só realocado).

### Aba [ Anexos ]
- Lista de arquivos do exame/atendimento.
- Upload e download (preserva integração atual).

### Aba [ Impressão ]
- Botão "Imprimir / Gerar PDF" exatamente como hoje.
- Preview do laudo usando o **mesmo** HTML/CSS atual.
- Assinatura digital no rodapé (sem alteração).
- **Constraint dura:** nada do CSS @print, margens, rodapé 4mm ou
  assinatura é alterado. Critério de aceite na implementação futura:
  HTML do laudo impresso **byte-a-byte idêntico** antes/depois.

### Menu "Mais ações" (botão `⋯` no header)
- Auditoria detalhada
- Cancelar liberação
- Retificar com diff
- Trocar analista
- Exportar PDF customizado

---

## 4. Modo consulta (`?modoConsulta`)
- Abas continuam visíveis (Resultado, Histórico, Anexos, Impressão).
- Campos de entrada renderizados em modo leitura, como hoje.
- Botões Salvar/Liberar ocultos.
- Sem alteração no regex de detecção do modo.

---

## 5. Impacto esperado (qualitativo, sem código alterado)

| Métrica | Antes | Depois (proposto) |
|---|---|---|
| Densidade da 1ª dobra | Alta (tudo junto) | Baixa (só Essencial) |
| Cliques para imprimir | 1 (header) | 1 (aba Impressão ou atalho header) |
| Cliques para ver histórico | 0 mas misturado | 1 (aba dedicada) |
| Risco de regressão de impressão | N/A | **Zero**, se implementado em modo aditivo (Tabs envolvendo conteúdo atual) |
| Curva de aprendizado | Média | Baixa (vocabulário "Resultado/Histórico/Anexos/Impressão" auto-explicativo) |

---

## 6. Limitação declarada
Esta proposta não altera nenhum arquivo do código. Implementação depende
de aprovação explícita em ciclo separado, sob o critério:
- Tabs **envolvem** o markup atual; não reescrevem.
- Aba Impressão reusa o **mesmo** componente/handler atual.
- Constraints `layout-impressao-travado` e
  `confirmacao-mudancas-estruturais` permanecem honradas.
