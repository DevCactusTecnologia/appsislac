# 01 — Modelo de Ameaças

## Ativos protegidos
| Ativo | Local | Sensibilidade |
|---|---|---|
| PHI clínico (pacientes, resultados, laudos) | `pacientes`, `atendimentos`, `atendimento_exames`, `amostras` | LGPD dados sensíveis (art. 5º II) |
| Credenciais de usuários | `auth.users` (Supabase Auth) | Alta |
| Financeiro (pagamentos, faturas, PIX) | `atendimento_pagamentos`, `convenio_faturas`, `caixa_sessoes` | Alta |
| Credenciais de integrações (Hermes, DBSync) | `integration_credentials` (cifradas) | Alta |
| Assinaturas digitais | bucket `assinaturas` | Alta |
| PDFs de laudo | bucket `resultados-externos`, `integration-pdfs` | Média-alta |
| Metadados de plataforma | `tenant_registry`, `platform_audit`, secrets `SB_SERVICE_ROLE_<ref>` | Crítica |

## Atores
1. **Anon** — visitante da landing/tenant site (`anon` JWT).
2. **Paciente** — acessa comprovantes via token curto.
3. **Usuário do tenant** — perfis `admin/manager/user` (RBAC por tenant).
4. **Super Admin** — plano de plataforma; bypass de RLS via `is_super_admin()`.
5. **Edge Function** — service-role, chamadas externas (WhatsApp webhook, PIX).
6. **Atacante externo** — internet aberta (endpoints públicos, buckets públicos).
7. **Atacante interno** — usuário legítimo tentando cross-tenant / escalada.

## Superfícies de ataque
- Frontend SPA (`appsislac.lovable.app` + custom domains via `tenant_pages`).
- 74 Edge Functions (algumas `verify_jwt=false` públicas).
- PostgREST direto (anon key exposta em `.env`).
- Storage HTTP (buckets `tenant-site`, `tenant-assets` públicos).
- Realtime channels (postgres_changes).
- Webhook WhatsApp (`whatsapp-webhook`, público por design).
- Shortlinks de comprovante (`/c/<token>`).

## Vetores
- Reuso de JWT expirado / token de outro projeto.
- Manipulação de `tenant_id` em requisições.
- SQL/RPC injection em campos livres.
- Upload de arquivos maliciosos (executáveis, XSS via SVG, path traversal).
- Enumeração via endpoints públicos (`tenant-resolve`, `leads-manager`, comprovantes).
- Bypass de super_admin (impersonation).
- Replay de webhook.
- IDOR em rotas de comprovante / integração.
