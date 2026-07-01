# 08 — Validation

- `bunx tsgo --noEmit` → **0 erros**.
- `bash scripts/check-data-plane-routing.sh` → **OK (12 functions)**.
- Edge functions do pipeline (`super-admin-*`) e do login (`tenant-resolve`, `tenant-dedicated-login-gate`) intocadas — nenhum arquivo do pipeline foi editado.
- Fachada cliente removida sem quebras: 150+ imports de `@/runtime/db` seguem funcionando via módulo consolidado que expõe o mesmo API.

Sem regressões introduzidas por esta cirurgia.
