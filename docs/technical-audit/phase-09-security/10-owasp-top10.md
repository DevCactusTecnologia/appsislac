# 10 — OWASP Top 10 (2021)

| # | Categoria | Status | Evidência |
|---|---|---|---|
| A01 | Broken Access Control | **Não encontrado (residual: inconclusivo)** | RLS uniforme (373 policies), edges revalidam JWT+super_admin. Auditoria caso-a-caso das 200 RPCs pendente. |
| A02 | Cryptographic Failures | **Parcial** | HTTPS end-to-end via Supabase; `integration_credentials` cifradas; senhas via bcrypt do GoTrue. **Sessão em localStorage** — categoria A05 mais precisamente. HMAC de protocolo com key rotativa. |
| A03 | Injection | **Não encontrado** | 0 raw SQL client-side; RPCs parametrizadas; `execute_sql` proibido; frontend usa Supabase client tipado. |
| A04 | Insecure Design | **Parcial** | RBAC + RLS bem desenhados. Faltam: MFA obrigatório, revogação de sessão, step-up para impersonation. |
| A05 | Security Misconfiguration | **Encontrado** | Bucket `tenant-site`/`tenant-assets` público sem confirmar allowlist de extensão. CORS `*` em endpoints autenticados (mitigado por JWT). Rate-limit in-memory. |
| A06 | Vulnerable & Outdated Components | **Inconclusivo** | Não executado `npm audit` nesta fase. |
| A07 | Identification & Auth Failures | **Encontrado** | MFA opcional; sem lockout aplicacional; refresh token em localStorage. |
| A08 | Software & Data Integrity Failures | **Não encontrado** | Migrations versionadas; edges deployadas via CLI Supabase; sem CDN externo para código. |
| A09 | Security Logging & Monitoring Failures | **Parcial** | `platform_audit`, `atendimento_audit`, `financeiro_audit`, `storage_audit`, `integration_logs` presentes. Sem SIEM externo confirmado. Logs de edge no dashboard Supabase — retenção limitada. |
| A10 | SSRF | **Inconclusivo** | Edges fazem fetch externo (WhatsApp, PIX, providers). Não auditada validação de URL destino. Provável baixo (URLs vêm de config server-side, não input do usuário). |
