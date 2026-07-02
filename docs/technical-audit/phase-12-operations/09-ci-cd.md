# 09 — CI/CD

| Etapa | Evidência (`.github/workflows/ci.yml`) | Status |
|---|---|---|
| Guards (no-mocks + file-size) | `scripts/check-no-mocks.sh`, `scripts/check-file-size.sh` | ✓ COMPROVADA |
| Typecheck | `bun run typecheck` (tsc --noEmit) | ✓ COMPROVADA |
| Lint | `bun run lint` (eslint) | ✓ COMPROVADA |
| Testes | `bun run test` (vitest) — cobertura baixa | ✓ COMPROVADA |
| Build | `bun run build` (vite) | ✓ COMPROVADA |
| Bloqueio de merge | `ci-status` job com `if: always()` valida agregação | ✓ COMPROVADA |
| Deploy step | Nenhum (delegado ao Lovable Cloud) | ✗ NÃO ENCONTRADA |
| Testes E2E no CI | `e2e/mapa-preview-cell-formatting.spec.ts` existe mas não é invocado no workflow | ✗ NÃO ENCONTRADA |
| Security scanning (SAST/deps) | Nenhum job | ✗ NÃO ENCONTRADA |
| Concurrency guard | `concurrency: cancel-in-progress` | ✓ COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| CI01 | Sem execução E2E no pipeline | ALTO |
| CI02 | Sem SAST/dependabot no workflow | ALTO |
| CI03 | Sem pipeline de deploy versionado | MÉDIO |
