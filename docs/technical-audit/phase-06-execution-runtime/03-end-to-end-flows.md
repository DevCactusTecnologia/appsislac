# 03 — End-to-End Flows

Reconstrução ponta a ponta dos fluxos mais representativos. Cada seta = camada real percorrida no código.

## F1 — Criar Atendimento
```
Usuário
 → NovoAtendimento.tsx (wizard)
 → services em pages/NovoAtendimento/services/*
 → atendimentoStore.create() (src/data/atendimentoStore/mutations.ts)
 → runtime/db.ts (db, ctx tenant via profiles)
 → Edge Function create-atendimento (supabase/functions/create-atendimento)
    → _shared/runtime/createClient
    → RPC create_atendimento_tx
       → valida catálogo/preço (calc_preco_atendimento_exame)
       → INSERT atendimentos + atendimento_exames
       → Trigger audit_atendimentos → atendimento_audit
       → Trigger ensure_tenant_billing_after_insert (indireto)
       → RLS: current_tenant_id() + has_permission()
 → Resposta {atendimento_id, protocolo}
 → Invalidação queryKey ["tenant", tenantId, "atendimentos"]
 → Realtime channel atendimentos → useRealtimeChannel → refetch
 → UI hidrata lista + Dashboard KPIs
```

## F2 — Registrar Pagamento (PIX dinâmico)
```
Usuário → PagamentoDialog.tsx
 → pixBrCode.ts (gera BR Code)
 → runtime/db.ts → RPC register_pagamento_tx
    → INSERT atendimento_pagamentos
    → recalcula saldo (calc_saldo_devedor)
    → Trigger audit_atendimento_pagamentos
    → RLS tenant + has_permission
 → Webhook PIX (edge) → confirma pagamento (UPDATE status → quitado)
 → Realtime → refetch financeiroStore
 → UI oculta [Gerar QRCode/Atualizar], exibe [Imprimir comprovante]
```

## F3 — Digitação e Liberação de Resultado
```
Usuário → ResultadoDetalhe.tsx
 → exameParametrosStore + valoresReferenciaStore + reguasEtariasStore
 → ParamTypedInput (máscara calculadora, ENTER navega)
 → criticoChecker.ts + ResultadoValidationBar
 → Analisado: UPDATE atendimento_exames.status='ANALISADO' + analista_id
 → Liberado (auditoria dupla, usuário distinto):
    → Edge sign-resultado
       → RPC sign_resultado_tx
          → UPDATE atendimento_exames
          → Trigger audit_atendimento_exames → atendimento_audit
          → RLS + RBAC (atendimento_exames_rbac_check_trg)
 → laudoResolver + laudoTemplate + historicoResultados (##GRAFICOHIST##)
 → laudoHtmlBuilder → Paged.js → PDF
 → Realtime → Mapa.tsx / Producao.tsx refetch
```

## F4 — Coleta de Amostra
```
Usuário → Coleta.tsx → move_amostra_tx
 → UPDATE amostras.status + amostra_movimentacoes INSERT (histórico)
 → Trigger audit_amostras
 → Realtime → sorotecaStore refresh
```

## F5 — Envio a Laboratório de Apoio (Hermes/DBSync)
```
Usuário/Cron → integration-jobs-runner (edge)
 → _shared/drivers/pipeline.ts (circuit breaker + retry + DLQ)
 → provider driver (dbsync/hermes) → transporte HTTP/SOAP
 → parse resposta → INSERT integration_results
 → UPDATE integration_jobs status=COMPLETED
 → healthRecord → provider_health_metrics
 → circuitRecordSuccess/Failure → provider_circuit_state
 → Realtime opcional → UI de status
```

## F6 — Migração Runtime (shared → dedicated)
```
Super Admin → SuperAdminMigration.tsx
 → sequência de edge functions super-admin-migration-*:
    check-tenant-schema → provision-tenant-schema[-full]
    → migrate-tenant-auth → migrate-tenant-data → migrate-tenant-storage
    → migration-smoke-test → migration-flip (UPDATE tenant_registry.runtime_mode='isolated_db')
 → tenant_migration_runs registra cada passo
 → UI hidrata timeline a partir da tabela
 → Rollback / purge-tenant-from-shared disponíveis
```

## F7 — Login
```
Usuário → LoginV2 → supabase.auth.signInWithPassword
 → onAuthStateChange (AuthContext)
    → carrega profiles + user_roles
    → installQueryClientTenantReset(queryClient, tenantId)
    → bootDataStores()
 → Navigate /dashboard | /super-admin
```

## F8 — Inscrição pública
```
Landing → Inscricao.tsx → Edge leads-manager
 → INSERT inscricoes (email + senha_hash)
 → RLS pública controlada
```

## F9 — Chat IA
```
AssistenteSISLAC → fetch ai-chat
 → _shared/aiAuth valida sessão
 → Lovable AI Gateway (Gemini 2.0 flash)
 → skills/{paciente,atendimento,resultado}.ts → tools → banco
 → INSERT ai_audit
 → Resposta streamed → UI
```

## F10 — Impressão em Lote de Laudos
```
Rotina → laudoBatchPdf.ts (processamento paralelo)
 → múltiplos ResultadoDetalhe headless → Paged.js
 → concat PDF único
```
