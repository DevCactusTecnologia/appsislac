# 13 — Operational Maturity

| Dimensão | Evidência | Status |
|---|---|---|
| Alta disponibilidade | Delegada 100% ao Lovable Cloud; sem multi-region declarada no repo | △ PARCIALMENTE COMPROVADA |
| Recuperação | Rollback de tenant (30d) ✓; restore aplicacional ✗ | △ PARCIALMENTE COMPROVADA |
| Monitoramento | Logs Cloud + auditoria interna ✓; APM/alertas ✗ | △ PARCIALMENTE COMPROVADA |
| Governança | Migrations versionadas, RLS, super-admin isolado, `tenant_migration_runs`, `platform_audit` | ✓ COMPROVADA |
| Auditabilidade | 7+ tabelas de auditoria (Fase 09/10) | ✓ COMPROVADA |
| Automação de deploy | CI bloqueante ✓; deploy delegado ao Cloud (sem pipeline próprio) | △ PARCIALMENTE COMPROVADA |
| Runbooks | Apenas migração de tenant e compliance | △ PARCIALMENTE COMPROVADA |
