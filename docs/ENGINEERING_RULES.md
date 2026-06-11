# SISLAC — Engineering Rules

> Regras permanentes de engenharia. Toda PR deve respeitá-las.
> Violações justificadas vão em ADR (`docs/adr/`).

## Filosofia

> **Código simples vence código inteligente.**
>
> O objetivo do SISLAC não é ser menor — é não se tornar mais complexo do que precisa ser.

## Proibido

- ❌ Criar nova store global sem justificativa (ver `governance/state-governance.md`)
- ❌ Duplicar regra de negócio em múltiplas camadas (ver `governance/single-source-of-truth-audit.md`)
- ❌ Criar abstrações genéricas sem uso real (`BaseStore<T>`, `UniversalForm`, etc.)
- ❌ Arquivos acima de **2000 linhas** sem ADR
- ❌ Regras de negócio espalhadas entre SQL + Store + Página
- ❌ Frontend enviando `tenant_id` ao backend
- ❌ Contornar RLS, RBAC ou tenant isolation
- ❌ Reintroduzir Service Worker / PWA
- ❌ Criar `QueryClient` paralelo
- ❌ `if (provider === "X")` — usar capabilities

## Obrigatório

- ✅ Reutilizar módulos e componentes canônicos antes de criar novos
- ✅ Preferir composição sobre herança/generics
- ✅ Preferir **RPC** para agregações complexas
- ✅ Uma única fonte de verdade por regra de negócio
- ✅ Componentes ≤ 300 LOC, hooks ≤ 250 LOC, páginas ≤ 800 LOC (meta)
- ✅ Tipos compartilhados em `types.ts` do módulo
- ✅ Selectors granulares Zustand (`useStore(s => s.x)`)
- ✅ Schemas de escrita em mutações persistidas
- ✅ Cleanup de timers, listeners e canais realtime

## Multi-Tenant

- `tenant_registry` é fonte única de verdade
- Resolução SEMPRE via `src/lib/db/tenantResolver.ts` + `current_tenant_id()`
- Frontend NUNCA confia em `tenant_id` recebido
- Toda tabela de domínio: `tenant_id NOT NULL` + 4 RLS policies + GRANT explícito

## Segurança

Nunca contornar:
- **RLS** (Row Level Security)
- **RBAC** (`has_permission`, `has_role`)
- **Tenant isolation** (`current_tenant_id`)

Super Admin opera apenas via edge functions `super-admin-*` com service-role +
revalidação `is_super_admin`.

## Limites de arquivo

| Tipo | Meta | Alerta | Bloqueio |
|---|---|---|---|
| Página | 800 | 1000 | 2000 (sem ADR) |
| Componente | 300 | 500 | 1000 |
| Hook | 250 | 400 | — |
| Store | 1200 | 1500 | 2000 |

`scripts/check-file-size.sh` roda no CI. Allowlist em
`scripts/file-size-allowlist.txt`.

## Estrutura de módulo

Ver `governance/module-structure-standard.md`.

## Antes de adicionar código

1. Existe componente/hook/store equivalente? → reutilizar.
2. A regra já vive em outra camada? → consumir, não duplicar.
3. É agregação cross-tabela? → RPC.
4. É estado compartilhado por <3 telas? → local, não global.

## Governança de IA

Toda modificação por IA deve respeitar `docs/IA_ARCHITECTURE_RULES.md`.

## Referências

- `governance/single-source-of-truth-audit.md`
- `governance/frontend-business-logic-audit.md`
- `governance/state-governance.md`
- `governance/module-structure-standard.md`
- `governance/engineering-hotspots.md`
- `governance/engineering-governance-report.md`
- `IA_ARCHITECTURE_RULES.md`
- `auth.md`
- `tenant-runtime.md`
