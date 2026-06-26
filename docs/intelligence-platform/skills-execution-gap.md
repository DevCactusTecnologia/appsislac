# SISLAC Assistant — Auditoria de Skills × Intenções Operacionais

**Manifesto:** o Assistente existe para concluir tarefas. Toda intenção comum do usuário precisa ter um caminho de **execução** (não só de leitura).

## Skills atuais (8)

| Skill | Tipo | Status |
|---|---|---|
| `paciente_search` | leitura | ✅ |
| `paciente_create` | mutação | ✅ |
| `paciente_exames` | leitura | ✅ |
| `atendimento_count` | leitura | ✅ |
| `atendimento_summary` | leitura | ✅ |
| `resultado_open` | navegação | ✅ |
| `resultado_set_valor` | mutação | ✅ |
| `resultado_set_varios` | mutação | ✅ |

## Cobertura por domínio

| Domínio | Leitura | Execução | Gap |
|---|---|---|---|
| Paciente | ✅ | ✅ criar | falta `paciente_update` |
| Atendimento | ✅ contar/resumir | ❌ | **criar, cancelar, finalizar** |
| Resultado | ✅ abrir | ✅ digitar valores | **liberar oficialmente, salvar parcial explícito** |
| Orçamento | ❌ | ❌ | **criar, listar, converter em atendimento** |
| Coleta | ❌ | ❌ | **listar pendentes, marcar coletado** |
| Análise | ❌ | ❌ | **listar pendentes, marcar analisado** |
| Financeiro / Pagamento | ❌ | ❌ | **registrar entrada, registrar pagamento parcial** |
| Catálogo de exames | ❌ | ❌ | **buscar exame, ver preço** |
| Convênios | ❌ | ❌ | **listar, ver tabela** |

## Top-7 skills a adicionar (priorizadas pelo tempo que economizam)

1. `resultado_liberar` — confirma e libera oficialmente (irreversível → exige `_confirmed: true`).
2. `atendimento_create` — abre atendimento a partir de paciente + exames.
3. `atendimento_cancel` — cancela com motivo (irreversível → confirmar).
4. `pagamento_register` — registra entrada/pagamento parcial em atendimento.
5. `coleta_marcar` — marca amostra como coletada.
6. `orcamento_create` — gera orçamento e devolve link/WhatsApp.
7. `exame_search` — busca exame no catálogo (preço, sinônimos, porte).

## Regras aplicadas no system prompt (já vigentes)

- Prioridade absoluta da tarefa sobre conversa.
- Confirmação somente para ações irreversíveis (excluir, cancelar, liberar, BPA, envio externo).
- Pós-tool: 1 frase ≤ 8 palavras. Nunca silenciar.
- Silêncio inteligente no ditado (apenas o nome do parâmetro).
- "Deseja continuar?" após cada conclusão.

## Status

Auditoria entregue. **Nenhuma skill nova foi implementada nesta fase** (escopo: prompt + diagnóstico). Solicitar implementação explícita das 7 skills acima para fechar a lacuna executiva.
