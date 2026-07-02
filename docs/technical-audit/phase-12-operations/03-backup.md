# 03 — Backup

| Ativo | Evidência | Status |
|---|---|---|
| Banco (managed) | Backup gerenciado Lovable Cloud (não configurável no repo) | △ PARCIALMENTE COMPROVADA |
| Backup por tenant | `super-admin-tenant-backup`, `super-admin-tenant-snapshot` | ✓ COMPROVADA |
| Backup SQL manual | `scripts/backup-sql.ts` (dump por tenant) | ✓ COMPROVADA |
| Storage buckets | Nenhum script/edge de backup de buckets | ✗ NÃO ENCONTRADA |
| Secrets | Nenhum export/cofre externo | ✗ NÃO ENCONTRADA |
| Migrations | Versionadas em `supabase/migrations/` (355 arquivos) | ✓ COMPROVADA |
| Rotina agendada | Nenhum cron/workflow programado no repo | ✗ NÃO ENCONTRADA |
| Evidência de execução | Nenhum log/artefato armazenado | ? INCONCLUSIVA |

## Achados
| # | Item | Severidade |
|---|---|---|
| BAK01 | Backup de Storage não coberto | ALTO |
| BAK02 | Sem rotina agendada de snapshot por tenant | ALTO |
| BAK03 | Sem cofre/export documentado de secrets | MÉDIO |
| BAK04 | Sem evidência de teste de integridade | ALTO |
