# Portal do Paciente — Executive Report
> Audit date: 2025-07 | Read-only audit

## 1. How it really works

```
Paciente acessa:
  /site/:slug                → TenantSite (vitrine pública, RPC get_published_tenant_page)
  /verificar/:codigo         → VerificarComprovante (FNV-1a recomputado, sem DB)
  /p/:codigo                 → RedirectShortlink → edge comprovante-resolve
                                → comprovante_links.url_assinada → redirect 302
  Identidade (OTP/CPF)       → identidade_confirmacoes + lookup_paciente_publico
  Resultado PDF              → URL assinada Storage (TTL 1h) atrás do shortlink (TTL 24h)
```

Tudo público sem JWT é mediado por edge functions com service-role e checagens explícitas.

## 2. Riscos consolidados

| ID | Severidade | Evidência | Resumo |
|----|------------|-----------|--------|
| P1 | 🔴 P0 | OTP via `Math.random()` | Token previsível em fluxo de confirmação de identidade |
| P2 | 🔴 P0 | sem rate-limit em `lookup_paciente_publico` / shortlinks | Enumeração de CPFs/códigos possível |
| P3 | 🟠 P1 | TTL shortlink 24h vs URL assinada 1h | Shortlink "vivo" pode apontar para URL expirada → UX ruim, mas sem vazamento |
| P4 | 🟠 P1 | `solicitacoes_publicas` aceita INSERT anônimo | Spam de leads possível, sem captcha |
| P5 | 🟢 baixo | RLS por tenant_id nas tabelas operacionais | Cross-tenant bloqueado |

## 3. Veredito

- **Seguro:** 🟠 Médio — funcional, mas P1+P2 precisam mitigação antes de exposição em massa.
- **Escalável:** ✅ Edge functions stateless + Storage assinado.
- **Multi-tenant correto:** ✅ Slug/domínio resolvem tenant; RLS impede cruzamento.

## 4. Classificação

**Needs Hardening — bloqueante: P1 (OTP) e P2 (rate-limit).**
