# 07 — Secrets Management

| Item | Evidência | Status |
|---|---|---|
| `.env` do repo contém apenas publishable/anon | ✓ auditado (Fase 09 SEC03) | ✓ COMPROVADA |
| Service-role no frontend | Nenhuma ocorrência | ✓ COMPROVADA (ausência) |
| Armazenamento server-side | Lovable Cloud secrets (SUPABASE_SERVICE_ROLE_KEY, SB_SERVICE_ROLE_<ref>, HMAC, provider tokens) | ✓ COMPROVADA |
| Cifra de credenciais de integração | `_shared/drivers/credentials.ts` | ✓ COMPROVADA |
| Rotação automatizada de service-role | Nenhum procedimento no repo | ✗ NÃO ENCONTRADA |
| Rotação LOVABLE_API_KEY | Tool dedicado no Cloud | ✓ COMPROVADA |
| Segregação dev/prod | Cloud único → mesmos secrets | ✗ NÃO ENCONTRADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| SEC01 | Sem rotação automática service-role | MÉDIO |
| SEC02 | Sem segregação de secrets por ambiente | ALTO |
| SEC03 | Sem alerta em uso anômalo de service-role | MÉDIO |
