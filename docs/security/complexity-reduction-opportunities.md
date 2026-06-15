# SISLAC — Complexity Reduction Opportunities (Phase 8)

**Data:** 2026-06-15. Somente leitura.

Princípio: *novo dev entende em < 2 min?* — se não, é candidato.

---

## 1. RLS — substituir cadeias longas por helpers

Hoje:
```sql
USING (is_super_admin(uid)
  OR (tenant_id = current_tenant_id()
      AND (has_permission(uid,'a') OR has_permission(uid,'b') OR has_permission(uid,'c') OR has_permission(uid,'d') OR has_permission(uid,'e'))))
```

Proposta (P2, sem aplicar):
```sql
-- function:
create or replace function public.can_access_tenant_row(uid uuid, perms text[])
returns boolean language sql stable security definer set search_path=public as $$
  select is_super_admin(uid)
      or (current_tenant_id() is not null
          and exists (select 1 from unnest(perms) p where has_permission(uid, p)));
$$;

-- policy:
USING (can_access_tenant_row(auth.uid(), array['a','b','c','d','e']))
```

Ganho: cada policy vira **uma linha**. Mudar matriz de permissões fica em **um lugar**.
Tabelas que mais se beneficiam: `atendimento_exames`, `amostras`, `recoletas`, `resultados_entregas`.

---

## 2. Edge Functions — helpers compartilhados

Hoje cada `super-admin-*` repete:
```ts
const supa = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization')! }}});
const { data: { user } } = await supa.auth.getUser();
if (!user) return new Response('unauth', { status: 401 });
const { data: isSA } = await supa.rpc('is_super_admin');
if (!isSA) return new Response('forbidden', { status: 403 });
```

Proposta (P2):
```ts
// _shared/auth.ts
export async function requireSuperAdmin(req: Request) { ... }
export async function requireRoleInTenant(req: Request, roles: AppRole[]) { ... }
export async function auditAction(req: Request, action: string, payload: object) { ... }
```

Removeria ~15 linhas por função × 16 funções super-admin = **~240 linhas de boilerplate**.

---

## 3. RPCs — `touch_updated_at` genérico

~75 funções `touch_*_updated_at` / `tg_*_updated_at` com corpo idêntico:
```sql
NEW.updated_at := now(); RETURN NEW;
```

Proposta (P2): manter **uma** função `public.touch_updated_at()` e ajustar triggers para apontarem a ela. Já existe parcialmente; migrar resto incrementalmente.

---

## 4. RPCs — pipeline de atendimento

`create_atendimento_tx` é grande e mistura validação + preço + persistência + fatura + auditoria + notificação.
Proposta (P1, ver `docs/audits/laravel-vs-lovable-comparativo.md §3.4`): dividir em steps explícitos em uma única transação, nomeados:

```
[ValidateInput, ResolvePatient, PriceExams, PersistAtendimento, PersistExames, PersistPagamento, IssueInvoice, AuditEvent, EnqueueNotify]
```

---

## 5. Tabelas de auditoria (10 → 2)

Já documentado em `docs/audits/laravel-vs-lovable-comparativo.md §3.2`. Consolidar em `audit_operational` + `audit_platform` com views compat. **P3.**

---

## 6. Edge functions de upload (5 → 2)

`upload-image`, `upload-pdf`, `upload-assinatura`, `image-url`, `assinatura-url` → `upload-asset` + `asset-url` parametrizados por bucket. **P2.**

---

## 7. Quadro de oportunidades

| # | Tema | Esforço | Risco | Prioridade |
|---|---|---|---|---|
| 1 | `can_access_tenant_row(uid, perms[])` | M | Baixo | P2 |
| 2 | `_shared/{auth,audit}.ts` em edge | S | Baixo | P2 |
| 3 | `touch_updated_at()` único | M | Baixo | P2 |
| 4 | Pipeline `create_atendimento_tx` | L | Médio | P1 |
| 5 | 10 → 2 tabelas de auditoria | L | Alto | P3 |
| 6 | Upload functions 5 → 2 | S | Baixo | P2 |

**Fim Fase 8.** Nada alterado.
