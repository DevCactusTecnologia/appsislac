# Phase 2 — Paciente Skill

`supabase/functions/ai-chat/skills/paciente.ts`. Duas tools com Zod:

- **`paciente_search`** (`paciente.search`): aceita `query` (2–80 chars); aplica `ilike` em `nome` (normalizado NFD) e, quando há ≥3 dígitos, em `cpf`/`celular`/`telefone`. Retorna até 10. Executa via `userClient` → RLS isola o tenant. Sem `tenant_id` no input. Permissão: `visualizar_pacientes`.
- **`paciente_create`** (`paciente.create`): aceita `nome`, `cpf?`, `celular?`, `email?`, `sexo`, `data_nascimento?` e `_confirmed`. Sem `_confirmed=true` retorna `NEEDS_APPROVAL` com `preview` para a UI mostrar resumo. Insert via `userClient`; `tenant_id` é preenchido pelo trigger de tenant padrão da tabela. Permissão: `cadastrar_paciente`.

Erros tipados: `INVALID_INPUT` (Zod), `INTERNAL`, `NEEDS_APPROVAL`.
