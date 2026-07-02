# 08 — Configuration Management

| Item | Evidência | Status |
|---|---|---|
| Configuração centralizada por tenant | `tenant_registry`, `tenant_lab_config` | ✓ COMPROVADA |
| Feature flags globais | Não encontrado | ✗ NÃO ENCONTRADA |
| Config por ambiente | Não há separação dev/prod | ✗ NÃO ENCONTRADA |
| Versionamento de config | Via git em `supabase/config.toml` (auto-gen) e migrations | △ PARCIALMENTE COMPROVADA |
| CSP/headers | `vercel.json` (headers e CSP) — porém deploy real é Lovable Cloud | ? INCONCLUSIVA (aplica-se em Vercel apenas) |
| `.env` publishable versionado | ✓ | ✓ COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| CFG01 | Sem feature flags globais | MÉDIO |
| CFG02 | Sem separação de config por ambiente | ALTO |
| CFG03 | `vercel.json` não aplicável ao host atual (inconclusivo) | INFORMATIVO |
