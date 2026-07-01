# 02 — Consolidation

## Antes → Depois

### Client runtime
- **Antes:** 11 arquivos em `src/runtime/db/**` + `src/runtime/identity/**` (~555 linhas)
- **Depois:** 1 arquivo `src/runtime/db.ts` (~165 linhas)
- **API pública mantida** (compat com ~150 imports existentes): `db`, `getTenantContext`, `getCurrentTenantId`, `getCurrentTenantNome`, `getCachedTenantNome`, `getCachedTenantContext`, `clearTenantContextCache`, `installTenantAuthInvalidation`, `refreshContext`, `resetRuntime`, `getCurrentContext`, `RuntimeError`, tipos.

### Server runtime
- **Antes:** 4 arquivos + `TenantContextProvider` abstrato + `ServerIdentityValidator`.
- **Depois:** 2 arquivos: `runtime/db.ts` (fachada 3 padrões + resolveTenant inline) e `runtime/createClient.ts` (reexport).
- Resolução de tenant lida direto de `tenant_registry` dentro de `db.ts` — zero indireção.

### Guardrail
- Mensagem atualizada para apontar `docs/database-runtime/surgery/03-runtime-final.md`.
- Continua bloqueando regressão em 12 edge functions data-plane.
