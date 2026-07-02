# 08 — Release Criteria

Fonte: Phase 13/10, Phase 14/06+08.

## Já cumpridos (evidência em Phase 01–13)
- Isolamento multi-tenant por RLS + `current_tenant_id()`.
- Chokepoint único de dados (`src/runtime/db.ts`).
- Escrita crítica via RPC `*_tx`.
- CI bloqueante com guards de tamanho/dependências.
- Governança de migração Shared→Dedicated com auditoria.
- Auditoria por triggers em tabelas sensíveis.
- Super admin isolado da superfície de tenant.

## Dependem das 13 intervenções (Phase 14/06)
- I01 MFA super_admin + refresh cookie httpOnly.
- I02 Remoção policy anon + buckets privados.
- I03 Upload-guard (mime sniff).
- I04 Rate-limit persistido + rotação service-role.
- I05 Fechar enumeração signup.
- I06 Portal LGPD + anonimização.
- I07 Backup Storage + restore drill + down-migrations.
- I08 Runbooks (incident/DR/dependências).
- I09 Sentry (APM/erros).
- I10 Staging dedicado.
- I11 Paginação/partição/virtualização.
- I12 Testes contrato + smoke + split arquivos gigantes.
- I13 Consolidação Landing.

## Permanecem aceitos (Phase 15/04)
F-SEC-14, F-SEC-15, F-CODE-02, F-DATA-01, F-ARCH-01, F-SUP-01, F-CI-01, F-AUDIT-01.

Nenhum critério novo criado.
