# 06 — Validations

Mapeamento de validações — onde ocorrem e duplicações.

| Validação | Frontend | Edge Function | DB (RPC/CHECK/RLS) | Duplicada? |
|---|---|---|---|---|
| CPF único por tenant | `Pacientes.tsx` (aviso) | `create-atendimento` | UNIQUE constraint + RLS | Sim (defesa em profundidade) |
| CNPJ válido | `comprovantesValidation.validarCnpj` | — | — | Única (frontend) |
| CNES 7 dígitos | `comprovantesValidation` | — | — | Única |
| UF/Conselho RT | `comprovantesValidation` | — | — | Única |
| Idempotency-key atendimento | header | `create-atendimento` | RPC `create_atendimento_tx` | Sim (edge+db) |
| Permissão `criar_atendimento` | Sidebar oculta | `create-atendimento` (has_permission) | RLS + `has_role` | Sim (visibility+auth) |
| Tenant resolution | — | `resolveUserTenantId` | `current_tenant_id()` + RLS | Sim (edge+db) |
| Super admin re-check | — | Toda função `super-admin-*` | `is_super_admin()` policy | Sim |
| Preço exame | `pricing.calculateExamPrice` | — | — | Única |
| VR clínico | `parseValorReferencia` + `criticoChecker` | — | Fórmulas via `exame_parametros` | Compartilhada |
| Rate-limit público | — | `leads-manager` | `public_rate_limits` | Sim (edge+db) |
| Janela de edição | `atendimentoPolicy.isForaDaJanelaEdicao` | — | `app_settings.edit_window_hours` | Frontend consulta config |
| Justificativa auditoria | `AlertDialog` obrigatório | RPC `set_audit_justificativa` | Trigger auditoria | Sim (UI+DB) |
| Opt-out WhatsApp | — | `whatsapp-dispatcher` | `whatsapp_opt_out` | Única (dispatcher) |
| Circuit breaker | — | `integration-dispatch` | `provider_circuit_state` | Única (edge) |
| Runtime mode consistency | `runtime/db.ts` | `_shared/runtime/db.ts` | `tenant_registry` | Sim (cliente+server) |
| Confirmação PIX | — | webhook | `atendimento_pagamentos` | Única |
| Assinatura RT completa | `validarLaboratorioParaComprovante` | — | — | Única |
| Dupla auditoria (analisado≠liberado) | `ResultadoDetalhe` (UI trava) | — | Trigger `atendimento_audit` | Sim |
| Consentimento LGPD | `useCompliance` | `lgpd-consentimento` | Coluna paciente | Sim |
| Convite usuário | UI | `admin-invite-user` | RLS + role | Sim |
| Unicidade protocolo | — | RPC | `protocolo_sequence` + UNIQUE | Única (DB) |
| Códigos verificação comprovante | `codigoVerificacao` (FNV-1a) | — | — | Única (determinístico) |
| Fluxo condicional coleta/análise | Sidebar + `RotinaColetaAnaliseGuard` | — | `tenant_lab_config` | Sim (guard+config) |
