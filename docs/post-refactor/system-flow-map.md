# FASE 1 — Mapa de Fluxos do Sistema (pós-refatoração)

> Modo: **somente leitura**. Mapa derivado de `src/pages/*`, `src/domains/*`, `src/data/*Store.ts`, `supabase/functions/*` e migrations.

## 1. Atendimento

```text
Paciente (pacienteStore + src/domains/patient)
  ↓ cadastro/edição (Pacientes.tsx)
Novo Atendimento (NovoAtendimento.tsx — 2.570 LOC, formulário único)
  ↓ seleção de exames (exameCatalogoStore + tabelaPrecoStore)
  ↓ precificação dinâmica (src/domains/appointment/services/pricing.ts)
  ↓ persistência: edge fn `create-atendimento` / `update-atendimento` → atendimentoStore
Coleta (RegistrarColeta.tsx → rastreabilidadeStore + amostras)
  ↓ status derivado por src/lib/atendimentoStatus.ts
Análise (AnalisarAmostra.tsx)
  ↓ valores críticos: src/domains/result/services/criticoChecker.ts
Resultado (ResultadoDetalhe.tsx — 2.627 LOC)
  ↓ render/PDF: src/domains/result/services/comprovantes{Html,Render,Upload}.ts
Liberação (Resultados.tsx → atendimentoStore.liberar*)
  ↓ portal/whatsapp: whatsapp-send + comprovante-shortlink
```

## 2. Financeiro

```text
Orçamento (Orcamentos.tsx → orcamentoStore)
  ↓ conversão em atendimento (reaproveita pricing)
Cobrança (Financeiro.tsx — Entradas read-only do atendimentoStore)
  ↓ Pagamento (NovoAtendimento → atendimento_pagamentos)
Recebimento (Financeiro / convenioFaturasStore)
  ↓ Faturas de convênio: convenio_faturas + convenio_fatura_itens
Relatórios (Financeiro / Producao / Dashboard kpis)
```

Regra preservada: **Entradas são derivadas; edição só em Atendimento** (mem://features/financeiro/integridade-de-entradas).

## 3. Portal do Paciente

```text
Protocolo público → edge fn `comprovante-resolve` / `tenant-resolve`
  ↓ OTP (identidade_confirmacoes + public_rate_limits)
  ↓ Resultado (ResultadoDetalhe em modo consulta) / VerificarComprovante.tsx
  ↓ PDF: comprovantesRender → comprovante-shortlink → RedirectShortlink.tsx
```

## 4. WhatsApp

```text
Evento (liberação/critico/orientação) — RegistrarCriticoDialog, RegistrarEntregaDialog…
  ↓ whatsapp_mensagens (fila persistida)
  ↓ Envio: edge fn `whatsapp-send` (tenant_whatsapp_config)
  ↓ Confirmação: webhook `whatsapp-webhook` → atualiza status + logs
```

## 5. Super Admin

```text
SuperAdminLogin → guard is_super_admin
  ↓ Tenants: super-admin-{list,create,update,delete,impersonate}-tenant
  ↓ Usuários do tenant: super-admin-{import,update,reset}-tenant-admin
  ↓ Configurações/Planos: super-admin-{plans,change-tenant-plan,update-tenant-db-config}
  ↓ Backup/Snapshot: super-admin-tenant-{backup,snapshot}
  ↓ Governança/Métricas: super-admin-{metrics,billing}, platform_audit, tenant_provision_audit
```

Total: **52 edge functions** ativas, **8 domínios** (`appointment, auth, exam, finance, notification, patient, result, tenant`), **~30 stores Zustand** e **~98 tabelas** com RLS multi-tenant via `current_tenant_id()` / `is_super_admin()` / `has_role()`.
