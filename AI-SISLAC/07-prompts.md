# 07 — Prompts

## Inventário de prompts

| Prompt | Local | Tamanho | Status |
|---|---|---|---|
| System prompt principal | `ai-chat/index.ts:45-116` | ~2 KB (montado por turno) | Ativo |
| Tool descriptions | inline em cada `tool({ description })` | curtas | Ativo |
| Prompt do ElevenLabs Agent | — | — | **Removido** |
| Prompt do Manifest | em `description` de cada Capability | — | Não consumido (Manifest morto na UI) |
| `promptTemplate` por Capability | `registry.ts` | curtos | Não consumido |

## Auditoria do system prompt

Pontos fortes:
- Persona consistente ("colaborador de laboratório", não chatbot).
- Regras explícitas de tool calling (itens 1-7).
- Modo conversa vs operacional bem distinto.

Problemas identificados:
1. **Regras contraditórias com a UI**
   - Linha ~72: "Suas respostas serão lidas em voz alta — frases curtas (≤8 palavras)". Esta regra vale para voz, mas é aplicada também no **modo texto** porque o prompt é único. Isso é exatamente a queixa "modo texto não consegue ter respostas precisas".
2. **Conhecimento duplicado**
   - Lista de status (`STATUS_CONHECIDOS`) repetida em `skills/atendimento.ts` e implícita no prompt.
   - Rotas mencionadas no prompt sobrepõem-se às do `parseLocalIntent`.
3. **`stopWhen: stepCountIs(5)`** combinado com persona "não abandona tarefa pela metade" gera frustração em fluxos multi-step (ex.: pesquisar paciente → abrir resultado → set vários valores → liberar = pode estourar antes do fim).
4. **Knowledge base não injetada**: o prompt afirma "use os manuais" mas nenhum dos 15 manuais de `docs/assistant-knowledge/` é incluído no contexto.
5. **`JSON.stringify(ctx)` cru** (linha 112) — vaza estrutura técnica para o LLM em vez de descrever em PT-BR.

## Duplicações entre prompts

- Não há "prompts de skill" separados — boa decisão.
- Há **3 fontes de regras de comportamento**:
  - System prompt.
  - `docs/assistant-knowledge/conversation-guidelines.md` (não carregado).
  - `docs/assistant-knowledge/execution-guidelines.md` (não carregado).
  - Resultado: o documento existe, mas o LLM nunca o vê. **Conhecimento morto**.
