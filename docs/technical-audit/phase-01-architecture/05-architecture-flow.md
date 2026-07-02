# 05 — Architecture Flow (real)

Fluxos reconstruídos a partir do código. Todos incluem passagem pelo runtime resolver antes do banco.

## Fluxo padrão (leitura)
```
Componente (src/pages/**)
   └── useEffect / hook (src/hooks/**)
         └── Store (src/data/*Store.ts)      # ensureLoaded()
              └── src/runtime/db.ts          # getUserTenantClient(userId)
                    └── @supabase/supabase-js
                          └── PostgreSQL (RLS: current_tenant_id / has_role)
                    └── (opcional) Realtime channel → useRealtimeChannel
   ← estado hidratado → TanStack Query cache → re-render
```

## Fluxo padrão (escrita transacional)
```
Componente → mutação no Store → runtime/db.ts → RPC/insert/update
   → invalidação de queryKey ["tenant", tenantId, ...]
   → Realtime broadcast opcional → refetch por subscribers
```

## Fluxo de criação de atendimento
```
NovoAtendimento (wizard) → services/* em pages/NovoAtendimento/services
   → atendimentoStore.create()
   → runtime/db.ts
   → Edge Function `create-atendimento`  # transacional / valida catálogo/preço
   → RLS + policies (public.atendimentos)
   → atualização de financeiroStore (Entradas geradas)
```

## Fluxo de laudo / resultado
```
ResultadoDetalhe (pages/ResultadoDetalhe.tsx + services)
   → carrega parâmetros (exameParametrosStore), layouts (exameLayoutsStore),
     réguas etárias (reguasEtariasStore), VR (valoresReferenciaStore)
   → digitação (ParamTypedInput) → validação (criticoChecker / ResultadoValidationBar)
   → Análise + Liberação (auditoria dupla) → sign-resultado (edge)
   → laudoResolver + laudoTemplate → printHtml → paged.js → PDF
   → laudoBatchPdf.ts para lote (execução paralela)
```

## Fluxo de laboratório de apoio
```
LabApoio (page)
   → labApoioStore + roteamento (RoteamentoApoioPanel)
   → integrations/providers/{dbsync|hermes-pardini}
   → contracts/{transport,capabilities,providers}
   → Edge functions: lab-apoio-adapter, lab-apoio-cron-fetch,
     lab-apoio-upload-pdf, integration-poll-results,
     integration-pdf-resolve, integration-pdf-url, integration-jobs-runner
   → Postgres (jobs, credenciais, PDFs referenciados no Storage)
```

## Fluxo Super Admin
```
/super-admin/** (RequireSuperAdmin guard)
   → SuperAdminLayout + páginas (SuperAdminDashboard, SuperAdminTenants, ...)
   → Fetch direto de edge functions `super-admin-*` com service-role
   → Validação server-side: is_super_admin() antes de operar
   → Operações: CRUD de tenants, provisionamento de schema,
     migração runtime (shared → isolated_db), impersonação,
     billing/planos, backups, snapshots, smoke-tests, purge.
```

## Fluxo de migração runtime (shared → dedicated)
```
SuperAdminMigration (page)
   → 24 edge functions super-admin-migration-* / super-admin-migrate-tenant-*
   → tenant_registry (runtime_mode)
   → _shared/migration/*, _shared/canonical/*, _shared/drivers/*, _shared/neonProvider.ts
   → Passos: check-tenant-schema, provision-tenant-schema[-full],
     migrate-tenant-{auth,data,storage}, migration-flip,
     migration-smoke-test, purge-tenant-from-shared (rollback correspondente)
   → Hidratação de UI via tabela tenant_migration_runs
```

## Fluxo de IA (chat / sugestão / OCR)
```
AssistenteSISLAC → fetch edge (ai-chat|ai-suggest-exames|ai-transcribe|extract-requisicao-exames)
   → _shared/aiAuth.ts (autoriza)
   → Lovable AI Gateway (Gemini 2.0 flash)
   → response streamed → UI
```

## Fluxo público
```
/            → Landing
/inscricao   → leads-manager (edge) → tabela inscricoes
/site/:slug  → TenantSite (via lib/tenantSite) → PostgreSQL (leitura pública controlada por RLS + edge sitemap)
/verificar/:codigo → comprovante-resolve (edge) → assinatura/comprovante
/p/:codigo   → RedirectShortlink → comprovante-shortlink (edge) → 302
```

## Fluxo de autenticação
```
LoginV2 (page) → supabase.auth.signInWithPassword
   → onAuthStateChange (AuthContext) → carrega profiles + user_roles
   → installQueryClientTenantReset(queryClient, tenantId)
   → bootDataStores() (pós-auth, ver App.tsx)
   → Navigate → /dashboard | /super-admin
```
