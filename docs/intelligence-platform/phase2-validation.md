# Phase 2 — Validation

## Build / Typecheck / Lint
Executados pelo pipeline da Lovable após cada edição. Esta fase compilou sem novos erros TS introduzidos (validado pelo loop do agent).

## Smoke tests manuais sugeridos
1. **Avatar**: logar em qualquer rota autenticada → ver botão flutuante; `Ctrl+J` abre/fecha painel; oculto em `/`, `/login`, `/inscricao`, `/laudo/print/*`.
2. **Modo Assistente**: painel abre com grade de Ações Rápidas (não com chat). "Cadastrar paciente" só aparece se o usuário tiver permissão `cadastrar_paciente`.
3. **Context Engine**: abrir `/pacientes/123` → contexto deve identificar `module="pacientes"`, `focus.pacienteId="123"`, e o chip de sugestão "Pesquisar histórico" aparece.
4. **Paciente Search**: digitar "pesquisar paciente: Maria" → LLM deve chamar `paciente_search` e devolver até 10 nomes do tenant.
5. **Paciente Create**: pedir cadastro → primeira chamada retorna `NEEDS_APPROVAL`; usuário confirma; segunda chamada insere e a row aparece no tenant (RLS valida).
6. **Multi-tenant**: trocar tenant via Super Admin → o painel não exibe threads/mensagens do tenant anterior; `paciente_search` retorna apenas o tenant atual.
7. **Permissões**: usuário sem `cadastrar_paciente` não vê o card "Cadastrar paciente" e, se forçar prompt, Edge não expõe a tool.
8. **Auditoria**: cada execução cria linha em `ai_audit` (verificar via `select * from ai_audit order by created_at desc limit 5`).

## Regressões
Nenhuma rota, store ou componente existente foi alterado. AI Shell é additive.
