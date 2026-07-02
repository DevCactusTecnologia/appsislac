# 13 — Penetration Review (teórico, sem execução)

| # | Ataque | Vetor | Resultado | Justificativa |
|---|---|---|---|---|
| P01 | Troca manual de `tenant_id` em INSERT | Cliente força `tenant_id` de outro tenant | **BLOQUEADO** | RLS `WITH CHECK (tenant_id = current_tenant_id())` em 116 tabelas. |
| P02 | Troca de JWT (roubado via XSS) | Sessão em `localStorage` acessível a scripts | **POSSÍVEL** | Sem HttpOnly cookies; sem rotação/binding a device. |
| P03 | Downgrade HTTPS → HTTP | MITM | BLOQUEADO | Supabase força TLS; sem HSTS aplicacional confirmado. |
| P04 | Chamada direta de RPC via PostgREST | fetch `/rest/v1/rpc/*` com anon JWT | BLOQUEADO se RPC não for grantada a `anon` | Convenção: RPCs sensíveis são `SECURITY DEFINER` mas revogadas de `anon`. Amostragem OK; **INCONCLUSIVO por escala (200 RPCs)**. |
| P05 | Execução direta de Edge sem JWT | curl endpoint público | BLOQUEADO em edges com `edgeBoot` (JWT required). `tenant-resolve`, `leads-manager`, `comprovante-resolve`, `whatsapp-webhook` são propositalmente públicos. |
| P06 | Storage enumeration via `list` | signed URL de path adivinhado | BLOQUEADO em buckets privados. **POSSÍVEL** em `tenant-site`/`tenant-assets` (public) se path previsível. |
| P07 | Realtime cross-tenant | subscribe `postgres_changes` sem filtro | BLOQUEADO — RLS aplicado em replication slot. |
| P08 | Enumeração de usuários | `/auth/v1/signup` retorna `user already exists` | **POSSÍVEL** — comportamento default GoTrue. |
| P09 | Replay de request assinado | reenvio de request idempotência | INCONCLUSIVO — rate-limit in-memory; sem nonce global. |
| P10 | Escalada via `has_role` UPDATE | tentar UPDATE em `user_roles` | BLOQUEADO — policy restringe a `super_admin`; frontend não tem service role. |
| P11 | Impersonation abuse | super_admin assume identidade de admin de tenant | **POSSÍVEL AUDITADO** — funcionalidade legítima; risco = ausência de step-up MFA. |
| P12 | CSRF em edges com CORS `*` | | BLOQUEADO — JWT em `Authorization` header (não cookie). |
| P13 | Path traversal em upload | `name = "../../outra-tenant/x.pdf"` | BLOQUEADO — storage-api normaliza; policy usa `foldername[1]`. |
| P14 | SSRF via edge que faz fetch de URL do usuário | | INCONCLUSIVO — não auditado por edge. |
| P15 | SQL Injection | payload em input | BLOQUEADO — Supabase client parametrizado; sem `execute_sql`. |
