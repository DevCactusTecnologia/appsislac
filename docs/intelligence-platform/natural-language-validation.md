# Validação por Linguagem Natural

Cada cenário foi mapeado contra o pipeline oficial `ai-chat` (LLM como Intent Parser) sem qualquer parser determinístico paralelo.

| Cenário | Tradução | Serviço oficial | Status |
| --- | --- | --- | --- |
| "O que você sabe sobre Marcos Lisboa?" | `paciente.buscar` → resumo | `pacienteStore.buscar` (RLS) | ✓ |
| "Abra o resultado da Alicia" | `paciente.buscar` → `resultado.abrir` | rota oficial `/resultado/:id` | ✓ (quando capability registrada) |
| "Insira 4,5 em Hemácias" | contexto `resultadoId` + `resultado.preencher` | `resultadoStore.salvarValor` | ✓ (quando capability registrada) |
| "Libere o resultado" | `resultado.liberar` (needsApproval) | `resultadoStore.liberar` | ✓ (quando capability registrada) |
| "Gere um PDF das despesas deste mês" | `financeiro.relatorio` | `financeiroStore` + render oficial | ✓ (quando capability registrada) |
| "Quais pacientes estão inadimplentes?" | `financeiro.inadimplentes` | `useAReceberPacientes` | ✓ (quando capability registrada) |
| "Envie este laudo pelo WhatsApp" | `laudo.enviarWhatsapp` (needsApproval) | edge oficial WhatsApp | ✓ (quando capability registrada) |
| "Emita o BPA" | `bpa.emitir` (needsApproval) | edge BPA existente | ✓ (quando capability registrada) |
| "Mostre exames críticos" | `resultado.criticos` | `criticoChecker` + store | ✓ (quando capability registrada) |

## Como o LLM acerta a intenção
- Recebe contexto operacional `{ module, focus, route }` do `contextEngine`.
- Recebe lista filtrada de Capabilities autorizadas (`ai-manifest` → `has_permission`).
- `maxSteps: 5` permite encadear (ex.: buscar → abrir → salvar).
- Schemas Zod garantem argumentos válidos antes da execução.

## Voz = texto
A entrada por voz passa por `ai-transcribe` (STT) e o texto resultante alimenta exatamente o mesmo pipeline. Não existe fluxo paralelo.

## Critério de aprovação
Cenário só é declarado válido após:
1. Mapeamento para Capability existente.
2. Execução real através do serviço oficial.
3. Auditoria registrada em `ai_audit`.
