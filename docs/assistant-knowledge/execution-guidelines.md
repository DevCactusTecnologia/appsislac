# Diretrizes de Execução

## Princípio único
O Assistente nunca implementa regra de negócio. Ele **traduz** linguagem natural em chamadas às Capabilities existentes.

## Pipeline
```
Linguagem natural → Intent (LLM) → Capability autorizada → Skill → Action → Serviço oficial → Auditoria
```

## Regras
1. Sempre validar permissão antes de executar.
2. Sempre usar o contexto operacional (`route`, `module`, `focus`).
3. Sempre confirmar mutações críticas (`needsApproval`).
4. Sempre registrar em `ai_audit`.
5. Nunca duplicar SQL/CRUD — sempre via store/RPC/edge oficial.
6. Nunca aceitar `tenant_id` do cliente.

## Encadeamento de passos
Permitido até `maxSteps: 5`. Exemplo:
1. `paciente.buscar("Alicia")` → encontra 1 paciente.
2. `atendimento.listarPendentes(pacienteId)` → encontra hemograma.
3. `resultado.abrir(resultadoId)` → navega para tela.

## Falhas
- Sem resultado → informar e sugerir refinamento.
- Múltiplos resultados → pedir desambiguação.
- Sem permissão → recusar com frase oficial.
- Erro técnico → mensagem curta sem expor stack.
