# Plataforma 2.1 — Fase 7: Arquitetura de Auditoria

> **Regra:** apenas mapear; **nada consolidado**.

## Tabelas de auditoria

| Tabela | Escopo | Quem grava | Quem lê |
|--------|--------|------------|---------|
| `audit_logs` | genérica multi-domínio (legado) | triggers antigos + edge functions | Super Admin (`is_super_admin`) |
| `operational_audit` | operacional por tenant | forwarders (`fwd_atendimento_audit_to_operational`, `fwd_storage_audit_to_operational`, `fwd_pdf_override_audit_to_operational`, `fwd_protocolo_auditoria_to_operational`, `fwd_criticos_comunicacoes_to_operational`) | Admins do tenant |
| `platform_audit` | plataforma (super-admin) | `fwd_app_settings_audit_to_platform`, `fwd_to_platform_audit_generic`, edge `super-admin-*` | Super Admin |
| `financeiro_audit` | financeiro detalhado | triggers diretos em `caixa_sessoes`, `financeiro_saidas`, `financeiro_estornos` | Admins financeiros |
| `atendimento_audit` | atendimento detalhado | triggers diretos (`audit_atendimentos`, `audit_atendimento_exames`, `audit_atendimento_pagamentos`) | Admins do tenant |
| `app_settings_audit` | configurações por tenant | trigger em `app_settings` | Admins do tenant |
| `tenant_provision_audit` | criação/migração de tenant | edge `super-admin-create-tenant` | Super Admin |
| `pdf_override_audit` | overrides de PDF | UI explícita | Admins do tenant |
| `protocolo_auditoria` | assinatura de protocolos | trigger em `atendimentos`/`financeiro_saidas`/`orcamentos` | Auditoria |
| `storage_audit` | uploads/downloads | edge functions de storage | Super Admin |
| `subscription_changes_log` | mudanças de plano | trigger em `tenant_subscriptions` | Super Admin |

## Forwarders identificados

```
fwd_app_settings_audit_to_platform           app_settings_audit → platform_audit
fwd_atendimento_audit_to_operational         atendimento_audit  → operational_audit
fwd_audit_logs_split                         audit_logs         → operational/platform
fwd_criticos_comunicacoes_to_operational     criticos_comunicacoes → operational_audit
fwd_pdf_override_audit_to_operational        pdf_override_audit → operational_audit
fwd_protocolo_auditoria_to_operational       protocolo_auditoria → operational_audit
fwd_storage_audit_to_operational             storage_audit      → operational_audit
fwd_to_platform_audit_generic                * → platform_audit
fwd_legacy_dict_to_select_options            dicionario_legado  → select_options (não-audit)
```

## Observação

Há **redundância intencional**: cada tabela específica preserva detalhes do domínio, enquanto `operational_audit` e `platform_audit` agregam visão consolidada para admins/super-admins. O grafo é "fan-in" — gravação especializada, leitura consolidada.

## Recomendação

**Não consolidar nesta fase.** Uma consolidação exigiria:
1. retrofit dos relatórios (`docs/plataforma-2.0/duplication-audit.md` já confirma compatibilidade frágil),
2. revisão das policies (escopos distintos),
3. migration de dados históricos.

Fica como **débito documentado** para um futuro "Auditoria 2.0".
