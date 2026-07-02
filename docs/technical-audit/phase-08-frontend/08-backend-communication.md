# 08 — Backend Communication

## Chokepoint
`src/runtime/db.ts` (157 LOC) exporta `getUserTenantClient` — cliente Supabase tenant-aware. Consulta `tenant_registry.runtime_mode` (`shared` vs `isolated_db`) e retorna o cliente adequado.
Contraparte server: `supabase/functions/_shared/runtime/createClient.ts`.

## Métricas de chamada (grep em `src/`, .ts + .tsx)
- Arquivos chamando `supabase.rpc(...)`: **23**.
- Arquivos chamando `supabase.functions.invoke(...)`: **35**.
- Arquivos consumindo Realtime (`supabase.channel` / `useRealtimeChannel`): **6**.

## Quem chama RPC (padrão)
Predominantemente **stores** em `src/data/*Store*` e services em `src/domains/*/services/`. Pages/components raramente chamam RPC direto — delegam ao store.

Exemplos:
- `atendimentoStore/mutations.ts` → `update_atendimento_tx`, `create_atendimento_tx`.
- `pacienteStore.ts` → RPC de upsert.
- `financeiroStore.ts` → RPCs de entrada/saída.
- `valoresReferenciaStore.ts`, `reguasEtariasStore.ts` → RPCs de VR.

## Quem chama Edge Functions
- Pages de Super Admin (`SuperAdminMigration`, `SuperAdminTenants`, `SuperAdminNovoLab`) → `super-admin-*` (impersonation, migration, purge, provision).
- Integrações: `components/RoteamentoApoioPanel`, `LabApoio.tsx` → `lab-apoio-adapter`, `integration-*`, `provider-*`.
- IA: `components/assistente/AssistenteSISLAC.tsx` → `ai-chat`, `ai-speak`, `ai-transcribe`, `ai-suggest-exames`, `extract-requisicao-exames`.
- Pagamento: `PagamentoDialog.tsx` → webhook/consulta PIX.
- Impressão: `sign-resultado`, `assinatura-url`, `image-url`.

## Quem usa Runtime
Todo chamador de dados **transita** por `getUserTenantClient` (memory: chokepoint). Nenhum acesso direto a Postgres/URL hardcoded foi encontrado em pages (guard `scripts/check-data-plane-routing.sh` existe no repo).

## Quem usa Storage
Componentes de upload/preview: `PdfPreviewDialog`, upload de assinaturas em `components/configuracoes/`, comprovantes em `PagamentoDialog`, `ImpressaoLotePorLab`. Acesso é intermediado por edge functions (`assinatura-url`, `image-url`, `lab-apoio-upload-pdf`, `integration-pdf-*`).

## Quem usa Auth
- `AuthContext.tsx` (login/logout/session listener).
- `LoginV2.tsx`, `SuperAdminLogin.tsx`, `ResetPassword.tsx`, `Inscricao.tsx`.
- `RequireSuperAdmin.tsx`, `ProtectedRoute` — leem contexto, não chamam Auth diretamente.

## Padrão
Nenhum componente instancia `createClient` diretamente. Import canônico: `import { supabase } from "@/integrations/supabase/client"` (auto-gen) — usado apenas para Auth/Realtime; dados operacionais passam por `src/runtime/db.ts`.
