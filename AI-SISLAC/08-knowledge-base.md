# 08 — Knowledge Base

## Inventário (`docs/assistant-knowledge/`)
- 15 arquivos, ~650 LoC totais.
- Cobre: pacientes, exames, resultados, financeiro, BPA, soroteca, whatsapp, atendimento, inventário, laboratório, exemplos, segurança, guidelines de conversa, guidelines de execução, executive report.

## Carregamento em runtime
- **Nenhum**. `grep -r "assistant-knowledge"` em `src/` e `supabase/functions/` retorna zero matches.
- Não há embeddings, não há `RAG`, não há fetch desses .md em build.

## Onde o conhecimento realmente está
1. **System prompt do `ai-chat`** (~2 KB hardcoded).
2. **Descrições das tools** (poucas linhas cada).
3. **Lógica de negócio nas skills** (ex.: `STATUS_CONHECIDOS` em atendimento.ts).

## Conhecimento duplicado
- "Como pesquisar paciente" aparece em: `patients-manual.md`, `examples-catalog.md`, system prompt, e implícito no `paciente_search.description`.
- "Quando confirmar uma ação" aparece em: `safety-guidelines.md`, `execution-guidelines.md`, system prompt — três cópias.

## Conhecimento embutido em código que deveria estar na Base
- `parseLocalIntent` (regex de rotas) — deveria ser tabela única + reuso pelo LLM.
- Lista de status, lista de períodos, lista de módulos: hardcoded em ≥2 lugares cada.

## Conclusão

A "Knowledge Base" é decorativa. Custo de manutenção alto (15 .md), benefício operacional zero. Ou se carrega via RAG/inclusão em prompt, ou se descarta.
