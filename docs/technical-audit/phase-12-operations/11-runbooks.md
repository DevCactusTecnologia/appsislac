# 11 — Runbooks

Busca em `docs/` por procedimentos operacionais:

| Procedimento | Documento | Status |
|---|---|---|
| Migração tenant | `docs/database-runtime/*`, `docs/database-per-tenant-audit/*` | ✓ COMPROVADA |
| Deploy geral | Nenhum runbook | ✗ NÃO ENCONTRADA |
| Incidentes | Nenhum | ✗ NÃO ENCONTRADA |
| Falha de banco | Nenhum | ✗ NÃO ENCONTRADA |
| Falha de Storage | Nenhum | ✗ NÃO ENCONTRADA |
| Falha de integrações (PIX/WhatsApp/AI) | Nenhum | ✗ NÃO ENCONTRADA |
| Restore | Nenhum | ✗ NÃO ENCONTRADA |
| Compliance/LGPD | `GUIA_COMPLIANCE_IMPLEMENTACAO.md`, `LGPD_RDC_MIGRACAO_AUTOMATICA.md`, `docs/AI-SISLAC/Security.md` | ✓ COMPROVADA |
| Deployment guide geral | `GUIA-FINAL-DEPLOYMENT.md` | △ PARCIALMENTE COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| RUN01 | Sem runbook de incidentes | CRÍTICO |
| RUN02 | Sem runbook de falha por dependência externa | ALTO |
| RUN03 | Sem runbook de restore | CRÍTICO |
