# 07 — Supabase Security (Storage, Realtime, RPC, Auth, Secrets)

## Storage — 8 buckets

| Bucket | public | Policies |
|---|---|---|
| `comprovantes` | false | 4 (tenant-scoped por `foldername[1]`) |
| `resultados-externos` | false | 4 (tenant-scoped) |
| `integration-assets` | false | 4 (tenant-scoped via cast text) |
| `integration-pdfs` | false | 4 (tenant-scoped) |
| `provider-catalog-imports` | false | 4 (tenant-scoped + `has_permission`) |
| `assinaturas` | false | (não listadas na consulta — verificar) |
| `tenant-site` | **true** | 4 (write restrito a admin) |
| `tenant-assets` | **true** | 4 (write restrito) |

### Análise
- Isolamento: todas as policies usam `storage.foldername(name)[1] = current_tenant_id()::text` — **correto**.
- Buckets públicos (`tenant-site`, `tenant-assets`): SELECT ainda gate por policy `is_super_admin() OR foldername[1]::uuid = current_tenant_id()`. **Contradição**: bucket `public=true` bypassa policy no PostgREST endpoint `/object/public/`. Qualquer arquivo é acessível por URL direta se conhecer o path. Uso legítimo (assets de site público), mas **enumeração de UUIDs possível**.
- `assinaturas` — bucket privado; **auditar policies em migration** (não aparecem na query — pode indicar policies definidas fora do padrão).

## Realtime
- `useRealtimeChannel.ts` usa `postgres_changes` — respeita RLS.
- **Broadcast/Presence** — não auditado; se usado sem enforcement por canal, cross-tenant leak possível.

## RPC
- 200 funções em `public`. Convenção: SECURITY DEFINER + `SET search_path = public`.
- RPCs `*_tx` (transacionais) são únicos pontos de mutação de agregados críticos.
- **Enumeração RPC**: qualquer usuário autenticado pode chamar qualquer função `public` — RLS + checks internos são a defesa. Amostragem OK; auditoria caso-a-caso pendente.

## Auth
- Único provedor.
- OAuth providers: `configure_auth` não auditado nesta fase.
- MFA: não obrigatório (nem para super_admin).
- Password HIBP: **não confirmado**.

## Secrets
- Runtime secrets (Edge Functions env): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SB_SERVICE_ROLE_<ref>*`, HMAC keys, WhatsApp tokens, PIX keys.
- Publishable/anon key exposta no `.env` (esperado — publishable).

## Anon Key
- `VITE_SUPABASE_PUBLISHABLE_KEY` embarcada no bundle. **Correto** — anon RLS bloqueia acesso a domínio.

## Achados
| # | Item | Severidade |
|---|---|---|
| S01 | Buckets `tenant-site`/`tenant-assets` `public=true` — SELECT bypassa policy | MÉDIO (enumeração de path) |
| S02 | Policies do bucket `assinaturas` não visíveis na query padrão | INCONCLUSIVO |
| S03 | Realtime broadcast/presence sem enforcement documentado | INCONCLUSIVO |
| S04 | MFA opcional em todos os perfis | ALTO |
