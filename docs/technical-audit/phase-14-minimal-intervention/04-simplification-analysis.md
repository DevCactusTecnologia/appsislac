# 04 — Simplification Analysis

Para cada grupo pergunta-se: existe solução menor / mais simples / mais profissional?

| Grupo | Solução menor adotada |
|---|---|
| G1 | Ativar MFA obrigatório super_admin via config Supabase + migrar refresh para cookie httpOnly já suportado pelo SDK (`persistSession`+storage adapter). Sem novo runtime de sessão. |
| G2 | 1 migration SQL: DROP policy anon + ALTER bucket public=false. |
| G3 | 1 edge `upload-guard` com `file-type` sniff + reject SVG/exe. Client passa a chamar edge antes do PUT. Sem novo módulo de storage. |
| G4 | Trocar rate-limit in-memory por tabela `rate_limit_hits` (single-writer) + doc de rotação trimestral service-role. Nada de Redis. |
| G5 | Config `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=false` + resposta genérica. Sem código. |
| G6 | Página `/privacidade/meus-dados` + edge cron `lgpd-anonymize`. Reaproveita RLS e auth existente. |
| G7 | Script `scripts/backup-storage.ts` + `scripts/restore-drill.md` + 1 down-migration template. Sem ferramenta externa. |
| G8 | 4 runbooks .md (incident, restore, DR, dependencies). Sem tooling. |
| G9 | Sentry SDK (10 linhas em `main.tsx` + edge wrapper). Sem APM proprietário. |
| G10 | Provisionar 2º tenant Cloud "staging" + `.env.staging`. Sem infra nova. |
| G11 | Keyset já existe em `pacienteStore` — replicar em `documento_templates` (30 linhas). Partição por RANGE(created_at) mensal em `audit_logs` e `whatsapp_outbox`. `react-window` só em 2 listas provadas lentas. |
| G12 | Testes de contrato para 8 RPCs críticas + smoke Playwright do fluxo Atendimento→Resultado→Laudo. Split apenas de `ResultadoDetalhe.tsx` e `NovoAtendimento.tsx` por seções já existentes. |
| G13 | `rm src/pages/LandingPageResponsive.tsx` + rota única. |

Nenhuma solução exige nova camada, provider ou framework interno.
