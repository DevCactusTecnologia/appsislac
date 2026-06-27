# Capabilities — Registry oficial

SSOT: `supabase/functions/_shared/registry.ts`.
Cada Capability declara apenas: `id`, `description`, `permission`, `category`, `needsApproval`, `tool`.

| id                    | tool                | permission              | needsApproval | descrição |
|-----------------------|---------------------|--------------------------|---------------|-----------|
| `paciente.search`     | `paciente_search`   | `visualizar_pacientes`   | não           | Busca pacientes por nome/CPF/telefone. |
| `paciente.create`     | `paciente_create`   | `cadastrar_paciente`     | **sim**       | Cria paciente no tenant atual. |
| `paciente.exames`     | `paciente_exames`   | `visualizar_pacientes`   | não           | Lista exames de um paciente. |
| `atendimento.count`   | `atendimento_count` | `visualizar_atendimentos`| não           | Contagem por período/status. |
| `atendimento.summary` | `atendimento_summary` | `visualizar_atendimentos` | não         | Resumo agregado de atendimentos. |
| `resultado.open`      | `resultado_open`    | `liberar_resultado`      | não           | Abre tela de resultado (protocolo ou paciente+exame). |
| `resultado.set`       | `resultado_set`     | `liberar_resultado`      | **sim**       | Insere 1..N parâmetros de UM exame. |

## Como adicionar uma nova Capability

1. Implementar a Tool em `supabase/functions/ai-chat/skills/<dominio>.ts`.
2. Registrar no `registry.ts` com `tool` = nome exato exportado pelo `buildXTools`.
3. Garantir que `permission` exista em `public.has_permission`.
4. Se for mutação irreversível, marcar `needsApproval: true`.

Nada mais. Sem priority, sem ícone, sem manifest, sem promptTemplate.
