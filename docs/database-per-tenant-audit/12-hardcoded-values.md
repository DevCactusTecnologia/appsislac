# 12 — Hardcoded / Dependências fixas

| Local | Trecho | Tipo |
|-------|--------|------|
| `.env` | `VITE_SUPABASE_URL="https://xhaeozwdfjuvpxgguqqp.supabase.co"` | URL fixa do projeto |
| `.env` | `VITE_SUPABASE_PROJECT_ID="xhaeozwdfjuvpxgguqqp"` | Project ID fixo |
| `src/integrations/supabase/client.ts:5-12` | `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` | Singleton |
| 121 imports | `from "@/integrations/supabase/client"` | Acoplam todo o front ao client único |
| `src/lib/tenantSite/uploadAsset.ts:48,59` | `.storage.from("tenant-assets")` | Bucket fixo |
| `_shared/drivers/hermes-pardini/driver.ts:174` | `.storage.from("integration-assets")` | Bucket fixo |
| `_shared/drivers/dbsync/driver.ts:166` | `.storage.from("integration-assets")` | Bucket fixo |
| `_shared/tenantConnection.ts:25-26` | `SUPABASE_URL / SERVICE_ROLE_KEY` do env | Projeto fixo |
| Todas as edge functions | `Deno.env.get("SUPABASE_URL"/"SUPABASE_SERVICE_ROLE_KEY")` | Projeto fixo |
| `src/pages/superadmin/SuperAdminTenantDetalhe.tsx`, `assistente/AssistenteSISLAC.tsx`, `RedirectShortlink.tsx`, `validarCredenciaisAnalista.ts` | usam `VITE_SUPABASE_URL` diretamente | Build-time |
