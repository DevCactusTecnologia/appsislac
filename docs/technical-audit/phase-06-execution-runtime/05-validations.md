# 05 — Validations

Catálogo de validações observadas por camada.

## Frontend (UX / prevenção)
- Formulários: react-hook-form + zod em `NovoAtendimento`, `PagamentoDialog`, `ResultadoDetalhe`, cadastros.
- `criticoChecker.ts` — alerta antes de salvar.
- `ResultadoValidationBar` — bloqueio visual de liberação.
- `atendimentoPolicy.ts` — regras de estado antes de habilitar botões.
- Máscaras: valores numéricos, tempo MM:SS, telefone, CPF, data.

## Store / Service
- `pricing.ts` — precificação preliminar (antes de RPC oficial).
- `parseValorReferencia.ts` — parsing de VR textual.
- `comprovantesValidation.ts` — validação de comprovantes.

## Edge Functions
- `_shared/aiAuth.ts` — sessão para IA.
- `super-admin-*` — revalidam `is_super_admin` server-side.
- `create-atendimento`, `update-atendimento` — sanitizam input antes da RPC.
- `pipeline.ts` — valida circuit breaker antes de despachar.

## RPCs (`*_tx`)
- `create_atendimento_tx` — valida catálogo, unicidade de protocolo, preço.
- `update_atendimento_tx` — valida transição de estado.
- `sign_resultado_tx` — exige 2º usuário distinto.
- `register_pagamento_tx` — valida saldo devedor.
- `move_amostra_tx` — valida existência de local.

## Triggers
- `atendimento_exames_rbac_check_trg` — RBAC de exame por role.
- `audit_<tabela>` — escreve auditoria (não bloqueia).
- `updated_at` — timestamp automático.

## RLS
- 373 policies. Padrão de 4 policies por tabela (SELECT/INSERT/UPDATE/DELETE) com `current_tenant_id()` + `has_permission()` + `is_super_admin()`.
- Nenhuma tabela operacional com `USING (true)`.

## Banco (constraints)
- FKs (147), UNIQUE, CHECK em `status`, `tipo`, `valores`.
- `NOT NULL` em `tenant_id` em toda tabela de domínio.
