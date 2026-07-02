# 11 — Single Source of Truth

| Domínio | SSoT | Justificativa |
|---|---|---|
| Atendimento (estado, exames) | Tabela `atendimentos` + `atendimento_exames` | Únicas escritas via `*_tx`; stores derivam |
| Financeiro (Entradas) | `atendimento_pagamentos` (via `atendimentoStore`) | Regra explícita: Entradas são read-only, derivadas do atendimento |
| Resultado / Laudo | `atendimento_exames` (status, valor, laudo) | `sign_resultado_tx` é único vetor |
| Amostras | `amostras` + `amostra_movimentacoes` (histórico) | RPC `move_amostra_tx` |
| Precificação | RPC `calc_preco_atendimento_exame` + `tabela_preco_itens` | Fallback CBHPM/TUSS/Própria centralizado |
| Reference values | `valores_referencia` + `reguas_etarias` + RPC `resolve_vr_por_paciente` | Um único resolver server-side |
| Permissões | `user_roles` + RPC `has_role` / `has_permission` | Nunca em `profiles` |
| Tenant | `current_tenant_id()` a partir do JWT/session | Frontend nunca envia tenant_id |
| Runtime shared vs dedicated | `tenant_registry.runtime_mode` | Consumido por edges super-admin |
| Auditoria | Tabelas `*_audit` (trigger) | Padrão único, sem duplicação |
| Feature flags de laboratório | `tenant_lab_config` | Sidebar, wizard e services consultam |
| IA (histórico) | `ai_audit` | Toda interação IA registrada |
