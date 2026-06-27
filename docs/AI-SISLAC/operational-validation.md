# Operational Validation — AI-SISLAC 2.0

## Validação técnica

| Item                                                                          | Resultado |
|-------------------------------------------------------------------------------|-----------|
| `bunx tsgo --noEmit -p tsconfig.app.json`                                     | 0 erros |
| `rg -l "@/lib/ai/"` em src/                                                   | 0 matches |
| `rg -l "ai-manifest"` em src/ e supabase/                                     | 0 matches |
| Migração de drop de tabelas executada com sucesso                             | OK |
| Edge `ai-manifest` deletada do deploy                                         | OK |
| `AssistenteSISLAC.tsx` envia `context.mode` em todas as chamadas              | OK |

## Validação funcional (caminhos cobertos)

Cobertos pela mesma pipeline (texto e voz):

1. Pesquisar paciente → `paciente.search`.
2. Resumo do paciente → `paciente.exames`.
3. Abrir exame/resultado → `resultado.open` (por protocolo ou paciente+exame).
4. Inserir resultados (1 ou N parâmetros) → `resultado.set`.
5. Salvar → confirmação na UI.
6. Gerar PDF → fluxo existente em `ResultadoDetalhe` (fora do Assistente).
7. Responder perguntas → resposta livre via Gemini sem tool.

Texto e voz disparam o **mesmo** ai-chat, com o **mesmo** Registry e as **mesmas** Tools. A única diferença é o system prompt (`PROMPT_TEXT` vs `PROMPT_VOICE`).
