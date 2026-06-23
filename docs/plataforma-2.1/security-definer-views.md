# Plataforma 2.1 — Fase 1: Security Definer Views

## Diagnóstico

A auditoria identificou **7 ERRORs** do linter `0010_security_definer_view`. Causa: views públicas sem `security_invoker=on` — por default, executam com permissões do owner (`postgres`), efetivamente fazendo bypass das RLS do usuário consultando.

## Inventário

| View | Modo anterior | Modo aplicado | Justificativa |
|------|--------------|--------------|---------------|
| `exames_publicos_view`      | definer | **invoker** | Lê `exames_publicos`; já tem RLS por tenant |
| `financeiro_entradas`       | definer | **invoker** | Projeção de `atendimento_pagamentos`; RLS já isola |
| `vw_coleta_diaria`          | definer | **invoker** | Agrega `atendimento_exames`; RLS já isola |
| `vw_coletas_operacionais`   | definer | **invoker** | idem |
| `vw_liberacao_diaria`       | definer | **invoker** | idem |
| `vw_producao_diaria`        | definer | **invoker** | idem |
| `vw_producao_operacional`   | definer | **invoker** | idem |

Views que **já** estavam corretas (mantidas): `convenio_competencia_resumo`, `convenio_fatura_resumo`, `platform_health_aggregate`, `provider_health_current`, `tenant_public`, `unidades_publicas`.

## Ação

```sql
ALTER VIEW public.<view> SET (security_invoker = on);
```

Aplicado na migration `20260623_plataforma_2_1_hardening`.

## Resultado

- **7 ERRORs eliminados.**
- Nenhuma view foi recriada — apenas `reloptions` alterado.
- RLS, multi-tenant, portal público e dashboards permanecem funcionais (cada view continua lendo das mesmas tabelas; agora respeitando a identidade do usuário).
