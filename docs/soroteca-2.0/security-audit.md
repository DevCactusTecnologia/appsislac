# Soroteca 2.0 — Fase 1.9 — Segurança

## RLS — Tabela `amostras`

| Policy | Cmd | Quem pode |
|---|---|---|
| `amostras_select` | SELECT | `super_admin` OU (`current_tenant_id()` E uma de: `visualizar_atendimentos` / `registrar_coleta` / `analisar_amostra`) |
| `amostras_insert` | INSERT | `current_tenant_id()` E uma de: `registrar_coleta` / `editar_atendimento` / `criar_atendimento` / role `admin` |
| `amostras_update` | UPDATE | `current_tenant_id()` E uma de: `registrar_coleta` / `editar_atendimento` / `analisar_amostra` / role `admin` |
| `amostras_delete` | DELETE | `current_tenant_id()` E role `admin` |

## RLS — `amostra_sequence`
- `amostra_sequence_select` (SELECT) — mesmo tenant ou super_admin.
- **Sem policy de INSERT/UPDATE/DELETE** — gravação só via `gerar_codigo_amostra` (SECURITY DEFINER). Correto.

## Permissões mapeadas para operações

| Operação | Permissão hoje |
|---|---|
| Armazenar (criar) | `registrar_coleta` / `criar_atendimento` / `editar_atendimento` |
| Localizar (consultar) | `visualizar_atendimentos` / `registrar_coleta` / `analisar_amostra` |
| Atualizar localização | mesma da update (qualquer das 3 + admin) |
| Marcar como UTILIZADA | `analisar_amostra` (entre outras) |
| Descartar | UPDATE — qualquer das permissões de update ⚠️ |
| Deletar fisicamente | `admin` apenas |
| Emprestar | ❌ N/A — não existe |
| Expurgar (lote) | ❌ N/A — não existe |

## Riscos atuais

1. **Descarte não tem permissão dedicada** — qualquer perfil que possa atualizar amostra (incluindo coletor) consegue marcar DESCARTADA. Deveria existir `descartar_amostra`.
2. **Sem permissão dedicada `gerenciar_soroteca`** — toda a tela Soroteca é regulada indiretamente pelas mesmas permissões de coleta/análise.
3. **Audit_trigger registra `user_id`** — bom — mas não é exposto na UI da timeline.
4. **`atendimento_exames.amostra_id` é editável** — quem pode atualizar exame pode trocar a amostra vinculada. Não há trigger que valide compatibilidade (mesmo paciente/material).
5. **`localizacao` livre** — não há validação de unicidade física: duas amostras podem alegar a mesma posição.

## Auditoria

- `audit_trigger` ativo em `amostras` (INSERT/UPDATE/DELETE).
- `auditoria` é leitura via `operationalAuditReader` em outros módulos — Soroteca **não** consome.
- `AmostraDetalheDialog` monta timeline derivada de campos, não da auditoria oficial.

## Rastreabilidade

| Quem | O que | Quando | Fonte |
|---|---|---|---|
| Coletor (user_id) | Criou amostra | created_at | `auditoria` (não exibido) |
| Operador | Mudou localizacao | updated_at | `auditoria` (não exibido) |
| Operador | Descartou | updated_at | `auditoria` (não exibido) |
| Analista | Marcou utilizada via análise | data_analise (no exame) | derivado |
| Reuso | Vinculou amostra a novo exame | is_reutilizacao = true | derivado |

## Recomendações de segurança (Fase 2+)

1. Criar permissões dedicadas: `gerenciar_soroteca`, `descartar_amostra`, `emprestar_amostra`, `expurgar_amostra`.
2. Trigger que valida compatibilidade ao alterar `atendimento_exames.amostra_id`.
3. Trigger que bloqueia downgrade de status terminal (DESCARTADA/EXPURGADA → qualquer outro).
4. Função SECURITY DEFINER para alocação física (impede colisão de posição via constraint UNIQUE + trigger).
5. Expor timeline real de `auditoria` no detalhe da amostra.
6. Campo obrigatório `motivo` em descarte/expurgo/empréstimo.
